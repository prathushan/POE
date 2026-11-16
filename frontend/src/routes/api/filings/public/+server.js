// import { json } from '@sveltejs/kit';
// import { db } from '$lib/server/db';

// export const GET = async () => {
//   try {
//     const [rows] = await db.execute(`
//       SELECT 
//         id,
//         accession_number,
//         company_name,
//         company_cik,
//         filer_name,
//         filer_cik,
//         def14a_link,
//         item_number,
//         contact_name,
//         contact_email,
//         pdf_s3_key,
//         pdf_filename,
//         subject,
//         description,
//         created_at,
//         status
//       FROM filings
//       WHERE LOWER(status) = 'approved'
//       ORDER BY created_at DESC
//     `);

//     return json(rows);

//   } catch (err) {
//     console.log('PUBLIC API ERROR:', err);
//     return json({ message: 'Server error' }, { status: 500 });
//   }
// };

import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

export const GET = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  try {
    const result = await pool.query(`
      SELECT
        id,
        accession_number,
        filing_type,
        proposal_id,
        company_name,
        company_cik,
        filer_user_id,
        filer_name,
        filer_cik,
        def14a_link,
        item_number,
        contact_name,
        contact_email,
        memo_submitter,
        pdf_s3_key,
        pdf_filename,
        subject,
        description,
        proposal_topic,
        proposal_text,
        meeting_date,
        meeting_date_known,
        proxy_status,
        exclusion_basis,
        notice_date,
        company_letter_pdf_s3_key,
        company_letter_pdf_filename,
        response_pdf_s3_key,
        response_pdf_filename,
        has_no_action,
        has_exempt_solicitation,
        created_at,
        status
      FROM filings
      WHERE LOWER(status) = 'approved'
      ORDER BY created_at DESC
    `);

    return json(result.rows);

  } catch (err) {
    console.log('PUBLIC API ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};