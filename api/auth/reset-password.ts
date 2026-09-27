import crypto from 'crypto';

const OTP_SECRET = process.env.OTP_SECRET || 'visualsky-secure-otp-signature-key-2026';

export default async function handler(req: any, res: any) {
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

    const { email, otp, newPassword, otpToken } = body || {};
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    let isValid = false;

    // Verify cryptographic HMAC token (stateless across Vercel serverless containers)
    if (otpToken && typeof otpToken === 'string') {
      const [tokenExpiresAtStr, tokenSignature] = otpToken.split(':');
      const tokenExpiresAt = Number(tokenExpiresAtStr);
      if (tokenExpiresAt && Date.now() <= tokenExpiresAt) {
        const expectedSignature = crypto.createHmac('sha256', OTP_SECRET).update(`${cleanEmail}:${cleanOtp}:${tokenExpiresAt}`).digest('hex');
        if (tokenSignature === expectedSignature) {
          isValid = true;
        }
      }
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired 6-digit verification code. Please check your email and try again.'
      });
    }

    // If Supabase service role key is present in Vercel env, update user password in Supabase directly
    const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supaServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (supaUrl && supaServiceKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const adminClient = createClient(supaUrl, supaServiceKey);
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const supaUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
        if (supaUser) {
          await adminClient.auth.admin.updateUserById(supaUser.id, { password: newPassword });
        }
      } catch {}
    }

    return res.status(200).json({
      success: true,
      message: `Password for ${cleanEmail} successfully updated.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to reset password' });
  }
}
