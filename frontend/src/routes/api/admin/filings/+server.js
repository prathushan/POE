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
//         contact_name,
//         contact_email,
//         def14a_link,
//         item_number,
//         pdf_s3_key,
//         pdf_filename,
//         description,
//         subject,
//         status,
//         created_at
//       FROM filings
//       ORDER BY created_at DESC
//     `);

//     return json(rows);

//   } catch (err) {
//     console.log('FETCH FILINGS ERROR:', err);
//     return json({ message: 'Server error' }, { status: 500 });
//   }
// };

import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

export const GET = async () => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        accession_number,
        filing_type,
        proposal_id,
        company_name,
        company_cik,
        filer_name,
        filer_cik,
        contact_name,
        memo_submitter,
        contact_email,
        def14a_link,
        item_number,
        pdf_s3_key,
        pdf_filename,
        description,
        subject,
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
        vote_for,
        vote_against,
        vote_abstain,
        proxy_preview_interest,
        status,
        created_at
      FROM filings
      ORDER BY created_at DESC
    `);

    return json(result.rows);

  } catch (err) {
    console.log('FETCH FILINGS ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};