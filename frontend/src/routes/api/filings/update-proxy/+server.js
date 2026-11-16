import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Owner (or admin) updates a proposal's proxy status / AGM known flag.
// No admin approval required — publishes immediately.
export const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return json({ message: 'Not authenticated' }, { status: 401 });

  try {
    const { id, proxy_status, meeting_date_known } = await request.json();

    const r = await pool.query(
      `SELECT filer_user_id FROM filings WHERE id = $1 AND filing_type = 'proposal'`,
      [id]
    );
    const row = r.rows[0];
    if (!row) return json({ message: 'Proposal not found' }, { status: 404 });
    if (!user.is_admin && row.filer_user_id !== user.id) {
      return json({ message: 'Not your proposal' }, { status: 403 });
    }

    await pool.query(
      `UPDATE filings
         SET proxy_status = COALESCE($2, proxy_status),
             meeting_date_known = COALESCE($3, meeting_date_known)
       WHERE id = $1`,
      [id, proxy_status ?? null, typeof meeting_date_known === 'boolean' ? meeting_date_known : null]
    );
    return json({ success: true });
  } catch (err) {
    console.log('UPDATE-PROXY ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
