import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Distinct companies already on POE (any filer) with their CIK and most recent
// known meeting date — used by the New Proposal "Company Name" typeahead.
export const GET = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  try {
    // Companies already on POE = proposal companies (by company_name, which has the
    // real registrant CIK) PLUS legacy standalone exempt solicitations, whose target
    // company name is in memo_submitter (company_name there is the filer). Legacy rows
    // have no reliable target CIK, so we return null and the user fills it in.
    const result = await pool.query(`
      SELECT company_name, company_cik, to_char(meeting_date, 'YYYY-MM-DD') AS meeting_date
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(company_name)))
          company_name, company_cik, meeting_date
        FROM (
          SELECT company_name,
                 NULLIF(TRIM(company_cik), '') AS company_cik,
                 meeting_date
          FROM filings
          WHERE filing_type = 'proposal'
            AND company_name IS NOT NULL AND TRIM(company_name) <> ''
          UNION ALL
          SELECT memo_submitter AS company_name,
                 NULL::text AS company_cik,
                 meeting_date
          FROM filings
          WHERE filing_type = 'exempt_solicitation' AND proposal_id IS NULL
            AND memo_submitter IS NOT NULL AND TRIM(memo_submitter) <> ''
        ) u
        ORDER BY LOWER(TRIM(company_name)),
                 (company_cik IS NULL),           -- rows WITH a CIK (proposals) win
                 meeting_date DESC NULLS LAST
      ) t
      ORDER BY company_name ASC
    `);
    return json(result.rows);
  } catch (err) {
    console.log('COMPANIES ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
