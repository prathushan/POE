import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Send the reset link by email when SMTP is configured; otherwise log it.
// Configure via .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
// For a Google Workspace account (softscripts.net), use smtp.gmail.com:587 with
// an App Password (not the normal login password).
async function sendResetEmail(email, resetUrl) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`[PASSWORD RESET] (email not configured) ${email}: ${resetUrl}`);
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: email,
    subject: 'Reset your POE password',
    text:
      `We received a request to reset your Proxy Open Exchange password.\n\n` +
      `Reset your password using the link below (valid for 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html:
      `<p>We received a request to reset your <strong>Proxy Open Exchange</strong> password.</p>` +
      `<p><a href="${resetUrl}">Click here to reset your password</a> (link valid for 1 hour).</p>` +
      `<p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`,
  });
  return { sent: true };
}

export const POST = async ({ request, url }) => {
  try {
    const { email } = await request.json();
    if (!email) return json({ message: 'Email is required' }, { status: 400 });

    const result = await pool.query(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = result.rows[0];

    let devResetUrl;
    if (user) {
      // 32-byte token: raw goes in the link, only its hash is stored.
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [hashToken(token), expires, user.id]
      );
      const resetUrl = `${url.origin}/reset-password?token=${token}`;
      try {
        await sendResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        console.log('RESET EMAIL SEND ERROR:', mailErr);
        // Don't leak the failure to the client; the link is still valid.
      }
      if (dev) devResetUrl = resetUrl; // expose link in dev only, for testing
    }

    // Always the same response — never reveal whether an account exists.
    return json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(devResetUrl ? { devResetUrl } : {}),
    });
  } catch (err) {
    console.log('FORGOT PASSWORD ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
