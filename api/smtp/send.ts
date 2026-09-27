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
        return res.status(400).json({ success: false, error: 'Invalid JSON body in request' });
      }
    }

    const {
      to,
      toName,
      from,
      fromName,
      replyTo,
      subject,
      text,
      html,
      smtpConfig,
      trackingPixelId
    } = body || {};

    if (!to || !subject) {
      return res.status(400).json({ success: false, error: 'Recipient email and subject are required', status: 'failed' });
    }

    // Determine active SMTP or API provider configuration
    let activeSmtp = smtpConfig;

    if (!activeSmtp || (!activeSmtp.host && !activeSmtp.apiKey && !activeSmtp.password)) {
      if (process.env.RESEND_API_KEY) {
        activeSmtp = {
          provider: 'resend',
          apiKey: process.env.RESEND_API_KEY,
          fromEmail: process.env.SMTP_FROM || 'onboarding@resend.dev',
          fromName: process.env.SMTP_FROM_NAME || 'Visual Sky Outreach'
        };
      } else if (process.env.BREVO_API_KEY) {
        activeSmtp = {
          provider: 'brevo',
          apiKey: process.env.BREVO_API_KEY,
          fromEmail: process.env.SMTP_FROM || 'outreach@visualsky.agency',
          fromName: process.env.SMTP_FROM_NAME || 'Visual Sky Outreach'
        };
      } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        activeSmtp = {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 465,
          encryption: process.env.SMTP_SECURE === 'true' ? 'SSL' : 'TLS',
          username: process.env.SMTP_USER,
          password: process.env.SMTP_PASS,
          fromName: process.env.SMTP_FROM_NAME || 'Visual Sky Outreach',
          fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER
        };
      }
    }

    if (!activeSmtp || (!activeSmtp.host && !activeSmtp.apiKey && !activeSmtp.password)) {
      return res.status(400).json({
        success: false,
        error: 'No active email provider configured. Please connect your SMTP or Resend/Brevo account in Settings -> SMTP Accounts to send live emails.',
        status: 'failed'
      });
    }

    const pixelId = trackingPixelId || `px-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host || 'visualsky.pro';
    const protoHeader = req.headers?.['x-forwarded-proto'] || 'https';
    const origin = `${protoHeader}://${hostHeader}`;
    const pixelHtml = `<img src="${origin}/api/track/open/${pixelId}" width="1" height="1" style="display:none!important;width:1px!important;height:1px!important;opacity:0!important;border:none!important;" alt="" />`;

    let finalHtml = html;
    if (!finalHtml && text) {
      const formattedLines = text.split('\n').map((line: string) => line ? `<p style="margin: 0 0 12px 0;">${line}</p>` : '<br/>').join('');
      finalHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${formattedLines}</div>`;
    }
    if (finalHtml) {
      finalHtml += pixelHtml;
    }

    const authKey = activeSmtp.apiKey || activeSmtp.password || '';
    const senderEmail = activeSmtp.fromEmail || activeSmtp.username || from || 'outreach@visualsky.pro';
    const senderDisplayName = fromName || activeSmtp.fromName || 'Visual Sky Outreach';

    // 1. Direct Dispatch: Resend HTTPS API (Port 443 - 100% Reliable in Serverless)
    if (activeSmtp.provider === 'resend' || authKey.startsWith('re_')) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${senderDisplayName} <${senderEmail}>`,
            to: [toName ? `${toName} <${to}>` : to],
            subject,
            text: text || '',
            html: finalHtml || undefined,
            reply_to: replyTo || activeSmtp.replyToEmail || senderEmail,
            headers: {
              'X-VisualSky-Tracking-ID': pixelId
            }
          })
        });

        let resendData: any = {};
        try {
          const rawText = await resendRes.text();
          resendData = rawText ? JSON.parse(rawText) : {};
        } catch {
          resendData = { message: `Resend API returned status ${resendRes.status}` };
        }

        if (resendRes.ok && resendData.id) {
          return res.status(200).json({
            success: true,
            messageId: resendData.id,
            status: 'sent',
            trackingPixelId: pixelId,
            deliveredAt: new Date().toISOString(),
            relay: 'Resend HTTPS API (Port 443)'
          });
        } else {
          return res.status(resendRes.status >= 400 && resendRes.status < 500 ? resendRes.status : 400).json({
            success: false,
            error: `Resend API Dispatch Error: ${resendData.message || resendData.error || 'Failed to dispatch email'}`,
            status: 'failed'
          });
        }
      } catch (resendErr: any) {
        return res.status(500).json({
          success: false,
          error: `Resend Network Error: ${resendErr?.message || 'HTTPS request failed'}`,
          status: 'failed'
        });
      }
    }

    // 2. Direct Dispatch: Brevo HTTPS API (Port 443)
    if (activeSmtp.provider === 'brevo' || authKey.startsWith('xkeysib-')) {
      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': authKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: senderDisplayName, email: senderEmail },
            to: [{ email: to, name: toName || undefined }],
            subject,
            textContent: text || '',
            htmlContent: finalHtml || undefined,
            replyTo: { email: replyTo || activeSmtp.replyToEmail || senderEmail },
            headers: {
              'X-VisualSky-Tracking-ID': pixelId
            }
          })
        });

        let brevoData: any = {};
        try {
          const rawText = await brevoRes.text();
          brevoData = rawText ? JSON.parse(rawText) : {};
        } catch {
          brevoData = { message: `Brevo API returned status ${brevoRes.status}` };
        }

        if (brevoRes.ok && brevoData.messageId) {
          return res.status(200).json({
            success: true,
            messageId: brevoData.messageId,
            status: 'sent',
            trackingPixelId: pixelId,
            deliveredAt: new Date().toISOString(),
            relay: 'Brevo HTTPS API (Port 443)'
          });
        } else {
          return res.status(brevoRes.status >= 400 && brevoRes.status < 500 ? brevoRes.status : 400).json({
            success: false,
            error: `Brevo API Dispatch Error: ${brevoData.message || brevoData.error || 'Transmission failed'}`,
            status: 'failed'
          });
        }
      } catch (brevoErr: any) {
        return res.status(500).json({
          success: false,
          error: `Brevo Network Error: ${brevoErr?.message || 'HTTPS request failed'}`,
          status: 'failed'
        });
      }
    }

    // 3. Custom Nodemailer SMTP Socket Relay (Port 465 / 587)
    if (!activeSmtp.host) {
      return res.status(400).json({
        success: false,
        error: 'SMTP host is missing. Please configure a valid SMTP hostname (e.g., mail.visualsky.pro).',
        status: 'failed'
      });
    }

    const port = Number(activeSmtp.port) || 465;
    const isSecure = activeSmtp.encryption === 'SSL' || port === 465;

    // In Serverless (Vercel), enforce tight 7.5s connection and socket timeouts to prevent Vercel 10s execution kill
    const transporter = nodemailer.createTransport({
      host: activeSmtp.host,
      port,
      secure: isSecure,
      requireTLS: port === 587,
      auth: {
        user: activeSmtp.username,
        pass: authKey
      },
      connectionTimeout: 6500,
      greetingTimeout: 6500,
      socketTimeout: 7500,
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions: any = {
      from: `"${senderDisplayName}" <${senderEmail}>`,
      to: toName ? `"${toName}" <${to}>` : to,
      subject,
      text: text || '',
      html: finalHtml || undefined,
      replyTo: replyTo || activeSmtp.replyToEmail || senderEmail,
      headers: {
        'X-Mailer': 'VisualSky Cold Outreach Engine 2.0',
        'X-VisualSky-Tracking-ID': pixelId
      }
    };

    try {
      const sendPromise = transporter.sendMail(mailOptions);
      // Hard timeout promise at 8 seconds so it responds before Vercel can ever kill the lambda
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          const timeoutErr: any = new Error(`Connection timed out after 8s while connecting to ${activeSmtp.host}:${port}.`);
          timeoutErr.code = 'ETIMEDOUT';
          reject(timeoutErr);
        }, 8000);
      });

      const info: any = await Promise.race([sendPromise, timeoutPromise]);
      return res.status(200).json({
        success: true,
        messageId: info.messageId,
        status: 'sent',
        trackingPixelId: pixelId,
        deliveredAt: new Date().toISOString(),
        accepted: info.accepted,
        relay: `${activeSmtp.host}:${port}`
      });
    } catch (sendErr: any) {
      console.error('SMTP transmission failure on live send:', sendErr?.message);
      let friendlyError = sendErr?.message || 'Transmission rejected by remote SMTP server';
      
      if (sendErr?.code === 'EAUTH' || friendlyError.includes('535') || friendlyError.toLowerCase().includes('auth')) {
        friendlyError = `Authentication failed: Remote SMTP server rejected username "${activeSmtp.username}" or password. Please verify credentials.`;
      } else if (sendErr?.code === 'ETIMEDOUT' || sendErr?.code === 'ESOCKET' || friendlyError.includes('timed out')) {
        friendlyError = `Connection timed out: Server at ${activeSmtp.host}:${port} did not respond within 8 seconds. Cloud serverless IPs may be blocked by your hosting firewall. Tip: Try switching to Port 587 (TLS), check cPanel IP blocking, or use Resend/Brevo API.`;
      } else if (sendErr?.code === 'EDNS' || sendErr?.code === 'ENOTFOUND') {
        friendlyError = `DNS host resolution error: Could not resolve hostname "${activeSmtp.host}".`;
      } else if (sendErr?.code === 'ECONNREFUSED') {
        friendlyError = `Connection refused by remote host ${activeSmtp.host}:${port}. Port may be closed.`;
      }

      return res.status(400).json({
        success: false,
        error: `SMTP Relay Error: ${friendlyError}`,
        code: sendErr?.code || 'SEND_FAIL',
        status: 'failed'
      });
    } finally {
      try {
        transporter.close();
      } catch {}
    }
  } catch (err: any) {
    console.error('Unhandled error in /api/smtp/send:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Email delivery failed due to an unexpected server error',
      status: 'failed'
    });
  }
}
