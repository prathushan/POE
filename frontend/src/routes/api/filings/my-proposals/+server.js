import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Returns the signed-in user's own APPROVED proposals, for the
// "Link to Proposal" dropdown/typeahead in the attach modes.
export const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ message: 'Not authenticated' }, { status: 401 });

  try {
    const result = await pool.query(
      `SELECT id, company_name, company_cik, proposal_topic, meeting_date,
              created_at, has_no_action, has_exempt_solicitation
         FROM filings
        WHERE filing_type = 'proposal'
          AND LOWER(status) = 'approved'
          AND filer_user_id = $1
        ORDER BY company_name ASC`,
      [user.id]
    );
    return json(result.rows);
  } catch (err) {
    console.log('MY-PROPOSALS ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
