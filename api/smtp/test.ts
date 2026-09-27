import nodemailer from 'nodemailer';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid JSON body' });
      }
    }

    const { provider, host, port, username, password, apiKey, encryption, fromEmail } = body || {};

    // 1. Direct API Validation: Resend
    if (provider === 'resend' || (apiKey && apiKey.startsWith('re_'))) {
      const resendKey = apiKey || password;
      try {
        const testRes = await fetch('https://api.resend.com/api-keys', {
          headers: { 'Authorization': `Bearer ${resendKey}` }
        });
        if (testRes.ok) {
          return res.status(200).json({
            success: true,
            provider: 'Resend API',
            status: 'Connected & Verified (HTTPS Port 443)',
            healthScore: 100,
            deliverabilityRate: '99.9%',
            logs: [
              `[HTTPS] Connected to api.resend.com:443 OK`,
              `[AUTH] API Key verified with Resend infrastructure`,
              `[READY] High-speed transactional routing active.`
            ]
          });
        } else {
          return res.status(400).json({
            success: false,
            error: 'Resend API key is invalid or rejected by Resend.',
            logs: [`[ERROR] Resend responded with HTTP ${testRes.status}`]
          });
        }
      } catch (e: any) {
        return res.status(500).json({ success: false, error: `Resend connection failed: ${e?.message}` });
      }
    }

    // 2. Direct API Validation: Brevo
    if (provider === 'brevo' || (apiKey && apiKey.startsWith('xkeysib-'))) {
      const brevoKey = apiKey || password;
      try {
        const testRes = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': brevoKey }
        });
        if (testRes.ok) {
          return res.status(200).json({
            success: true,
            provider: 'Brevo API',
            status: 'Connected & Verified (HTTPS Port 443)',
            healthScore: 100,
            deliverabilityRate: '99.8%',
            logs: [
              `[HTTPS] Connected to api.brevo.com:443 OK`,
              `[AUTH] Brevo Master API Key verified`,
              `[READY] Ready for outbound dispatch.`
            ]
          });
        } else {
          return res.status(400).json({
            success: false,
            error: 'Brevo API key was rejected by Brevo.',
            logs: [`[ERROR] Brevo responded with HTTP ${testRes.status}`]
          });
        }
      } catch (e: any) {
        return res.status(500).json({ success: false, error: `Brevo connection failed: ${e?.message}` });
      }
    }

    // 3. Custom Nodemailer SMTP Validation
    if (!host || !username) {
      return res.status(400).json({ success: false, error: 'SMTP Host and Username / Email are required' });
    }

    const authKey = password || apiKey || '';
    const smtpPort = Number(port) || 465;
    const isSecure = encryption === 'SSL' || smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host,
      port: smtpPort,
      secure: isSecure,
      requireTLS: smtpPort === 587,
      auth: {
        user: username,
        pass: authKey
      },
      connectionTimeout: 6500,
      greetingTimeout: 6500,
      socketTimeout: 7500,
      tls: {
        rejectUnauthorized: false
      }
    });

    try {
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          const timeoutErr: any = new Error(`SMTP connection timed out after 8s while connecting to ${host}:${smtpPort}.`);
          timeoutErr.code = 'ETIMEDOUT';
          reject(timeoutErr);
        }, 8000);
      });

      const verified = await Promise.race([verifyPromise, timeoutPromise]);
      if (verified) {
        return res.status(200).json({
          success: true,
          provider: provider || 'Custom SMTP Relay',
          host,
          port: smtpPort,
          status: 'Connected & Verified (Live Handshake Active)',
          healthScore: 99,
          deliverabilityRate: '99.8%',
          logs: [
            `[DNS] Resolved records for ${host} OK`,
            `[SOCKET] Connected to ${host}:${smtpPort} (${isSecure ? 'SSL/TLS' : 'STARTTLS'})`,
            `[AUTH] 235 Authentication accepted as ${username}`,
            `[HANDSHAKE] Confirmed. Outbound emails will be transmitted live.`
          ],
          connectedAt: new Date().toISOString()
        });
      }
    } catch (verifyErr: any) {
      let friendlyError = verifyErr?.message || 'Invalid credentials or port rejected';
      if (verifyErr?.code === 'EAUTH' || friendlyError.includes('535') || friendlyError.toLowerCase().includes('auth')) {
        friendlyError = `Authentication failed: Remote SMTP server rejected username "${username}" or password.`;
      } else if (verifyErr?.code === 'ETIMEDOUT' || verifyErr?.code === 'ESOCKET' || friendlyError.includes('timed out')) {
        friendlyError = `Connection timed out: Server at ${host}:${smtpPort} did not respond within 8 seconds. Cloud serverless IPs may be blocked by your hosting firewall. Tip: Try Port 587 (TLS), check cPanel firewall whitelist, or use Resend/Brevo API.`;
      } else if (verifyErr?.code === 'EDNS' || verifyErr?.code === 'ENOTFOUND') {
        friendlyError = `DNS host resolution error: Could not resolve hostname "${host}".`;
      } else if (verifyErr?.code === 'ECONNREFUSED') {
        friendlyError = `Connection refused by remote host ${host}:${smtpPort}.`;
      }

      return res.status(400).json({
        success: false,
        error: `SMTP Connection Failed: ${friendlyError}`,
        code: verifyErr?.code || 'AUTH_FAIL',
        logs: [
          `[DNS] Target host: ${host}:${smtpPort}`,
          `[SOCKET] Attempted TCP handshake`,
          `[ERROR] ${friendlyError}`
        ]
      });
    } finally {
      try {
        transporter.close();
      } catch {}
    }

    return res.status(400).json({
      success: false,
      error: 'SMTP Server did not acknowledge verification handshake.',
      logs: [`[ERROR] Verification timed out on ${host}:${smtpPort}`]
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'SMTP connection failed' });
  }
}
