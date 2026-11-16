import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Distinct companies already on POE (any filer) with their CIK and most recent
// known meeting date — used by the New Proposal "Company Name" typeahead.
export const GET = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  try {
    const result = await pool.query(`
      SELECT company_name, company_cik, meeting_date
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(company_name)))
          company_name, company_cik, meeting_date
        FROM filings
        WHERE company_name IS NOT NULL AND TRIM(company_name) <> ''
          AND company_cik IS NOT NULL AND TRIM(company_cik) <> ''
        ORDER BY LOWER(TRIM(company_name)), meeting_date DESC NULLS LAST
      ) t
      ORDER BY company_name ASC
    `);
    return json(result.rows);
  } catch (err) {
    console.log('COMPANIES ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
