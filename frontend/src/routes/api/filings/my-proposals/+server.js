import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Returns the signed-in user's own proposals.
//  - default: APPROVED only (for the "Link to Proposal" attach-mode dropdown).
//  - ?all=1: every status (for the "Edit a submitted proposal" mode), with the
//    full editable fields so the modal can pre-fill the form.
export const GET = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return json({ message: 'Not authenticated' }, { status: 401 });

  const all = url.searchParams.get('all') === '1' || url.searchParams.get('all') === 'true';

  try {
    // Match the user's own proposals by filer_user_id. Fall back to the org
    // identity for rows whose filer_user_id was never linked (e.g. seeded or
    // imported proposals) so the owning org can still attach / update them.
    const org = user.org_name || '';
    const result = await pool.query(
      `SELECT id, company_name, company_cik, proposal_topic, proposal_text,
              to_char(meeting_date, 'YYYY-MM-DD') AS meeting_date, meeting_date_known, proxy_status, status,
              pdf_filename, created_at, has_no_action, has_exempt_solicitation
         FROM filings
        WHERE filing_type = 'proposal'
          AND (
                filer_user_id = $1
                OR (filer_user_id IS NULL AND $2 <> '' AND LOWER(TRIM(filer_name)) = LOWER(TRIM($2)))
              )
          ${all ? '' : "AND LOWER(status) = 'approved'"}
        ORDER BY company_name ASC`,
      [user.id, org]
    );
    return json(result.rows);
  } catch (err) {
    console.log('MY-PROPOSALS ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
