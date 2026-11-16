import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export const POST = async ({ request }) => {
  try {
    const { token, password } = await request.json();
    if (!token || !password) {
      return json({ message: 'Missing token or password' }, { status: 400 });
    }
    if (password.length < 6) {
      return json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id FROM users
        WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [hashToken(token)]
    );
    const user = result.rows[0];
    if (!user) {
      return json({ message: 'This reset link is invalid or has expired.' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users
          SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
        WHERE id = $2`,
      [hash, user.id]
    );

    return json({ success: true, message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    console.log('RESET PASSWORD ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
