import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

export const POST = async ({ request }) => {
  try {
    const data = await request.json();

    // await pool.query(
    //   `UPDATE filings SET
    //     memo_submitter = $1,
    //     company_name = $2,
    //     company_cik = $3,
    //     def14a_link = $4,
    //     item_number = $5,
    //     contact_name = $6
    //   WHERE id = $7`,
    //   [
    //     data.memo_submitter,
    //     data.company_name,
    //     data.company_cik,
    //     data.def14a_link,
    //     data.item_number,
    //     data.contact_name,
    //     data.id
    //   ]
    // );
await pool.query(
  `UPDATE filings SET
    memo_submitter = $1,
    company_name = $2,
    company_cik = $3,
    def14a_link = $4,
    item_number = $5,
    contact_name = $6,
    subject = $7
  WHERE id = $8`,
  [
    data.memo_submitter,
    data.company_name,
    data.company_cik,
    data.def14a_link,
    data.item_number,
    data.contact_name,
    data.subject,
    data.id
  ]
);
    return json({ success: true });

  } catch (err) {
    console.log(err);

    return json(
      { message: 'Server error' },
      { status: 500 }
    );
  }
};
