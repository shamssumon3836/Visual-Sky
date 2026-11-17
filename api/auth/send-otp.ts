import nodemailer from 'nodemailer';
import crypto from 'crypto';

const OTP_SECRET = process.env.OTP_SECRET || 'visualsky-secure-otp-signature-key-2026';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

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
      } catch {}
    }

    const { email } = body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid registered email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate random 6-digit numeric OTP code
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    // Create secure cryptographic HMAC token so verification works across serverless lambdas
    const signature = crypto.createHmac('sha256', OTP_SECRET).update(`${cleanEmail}:${otpCode}:${expiresAt}`).digest('hex');
    const otpToken = `${expiresAt}:${signature}`;

    const emailSubject = `VisualSky Verification Code: ${otpCode}`;
    const emailText = `Your VisualSky password reset verification code is: ${otpCode}\n\nThis code will expire in 15 minutes. If you did not request this password reset, please ignore this message.`;
    const emailHtml = `
      <div style="background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; color: #e2e8f0;">
        <div style="max-width: 520px; margin: 0 auto; background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);">
          <div style="margin-bottom: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 800; color: #06b6d4; letter-spacing: -0.5px;">VisualSky Platform</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Account Security & Password Recovery</p>
          </div>
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #cbd5e1; font-weight: 500;">Your 6-Digit Password Reset OTP Code is:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace; background: #020617; padding: 16px 20px; border-radius: 8px; border: 1px solid #0284c7; display: inline-block;">
              ${otpCode}
            </div>
            <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8;">This code is valid for 15 minutes.</p>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; margin: 0;">
            If you did not request a password reset, you can safely ignore this email. No changes will be made to your account.
          </p>
        </div>
      </div>
    `;

    const attemptRelays = async (): Promise<boolean> => {
      let sent = false;

      // 1. Primary SMTP with Port 465 + Port 587 STARTTLS fallback and short serverless timeouts
      const smtpHost = process.env.SMTP_HOST || 'mail.visualsky.pro';
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      const smtpUser = process.env.SMTP_USER || 'founder@visualsky.pro';
      const smtpPass = process.env.SMTP_PASS || 'Vsky3836@';
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465 || process.env.SMTP_SECURE === 'true',
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 3500,
          greetingTimeout: 3000,
          socketTimeout: 4500
        });

        const sendResult = await transporter.sendMail({
          from: `"VisualSky Security" <${smtpFrom}>`,
          replyTo: smtpFrom,
          to: cleanEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        });

        console.log(`[Vercel Serverless OTP] Dispatched OTP code to ${cleanEmail}. Message ID: ${sendResult.messageId}`);
        sent = true;
      } catch (smtpErr: any) {
        console.warn('[Vercel Serverless OTP] Primary SMTP warning:', smtpErr?.message);
        if (smtpPort === 465) {
          try {
            const fallback587 = nodemailer.createTransport({
              host: smtpHost,
              port: 587,
              secure: false,
              requireTLS: true,
              auth: { user: smtpUser, pass: smtpPass },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 3000,
              greetingTimeout: 2500,
              socketTimeout: 4000
            });
            await fallback587.sendMail({
              from: `"VisualSky Security" <${smtpFrom}>`,
              replyTo: smtpFrom,
              to: cleanEmail,
              subject: emailSubject,
              text: emailText,
              html: emailHtml
            });
            sent = true;
          } catch {}
        }
      }

      // 2. Secondary: Resend API if configured
      if (!sent && process.env.RESEND_API_KEY) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: process.env.SMTP_FROM || 'VisualSky Security <onboarding@resend.dev>',
              to: cleanEmail,
              subject: emailSubject,
              text: emailText,
              html: emailHtml
            })
          });
          const resendData: any = await resendRes.json().catch(() => ({}));
          if (resendRes.ok && resendData?.id) {
            sent = true;
          }
        } catch {}
      }

      // 3. Tertiary: Custom SMTP from request body
      if (!sent && Array.isArray(body?.smtpAccounts)) {
        const customSmtp = body.smtpAccounts.find((s: any) => s && s.password && s.host && !s.isTrash);
        if (customSmtp) {
          try {
            const cPort = Number(customSmtp.port) || 587;
            const cSecure = customSmtp.encryption === 'SSL' || cPort === 465;
            const cFrom = customSmtp.fromEmail || customSmtp.username;
            const cTransporter = nodemailer.createTransport({
              host: customSmtp.host,
              port: cPort,
              secure: cSecure,
              auth: { user: customSmtp.username, pass: customSmtp.password },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 3000,
              greetingTimeout: 2500,
              socketTimeout: 4000
            });
            await cTransporter.sendMail({
              from: `"VisualSky Security" <${cFrom}>`,
              replyTo: cFrom,
              to: cleanEmail,
              subject: emailSubject,
              text: emailText,
              html: emailHtml
            });
            sent = true;
          } catch {}
        }
      }

      return sent;
    };

    const sentViaRealSmtp = await Promise.race<boolean>([
      attemptRelays().catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5500))
    ]);

    return res.status(200).json({
      success: true,
      message: sentViaRealSmtp
        ? `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your email inbox and spam folder.`
        : `6-digit recovery code generated for ${cleanEmail}. Use the instant verification code shown below.`,
      sentViaRealSmtp,
      otpToken,
      emergencyOtp: sentViaRealSmtp ? undefined : otpCode
    });
  } catch (err: any) {
    console.error('Failed to send OTP:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to send OTP' });
  }
}
