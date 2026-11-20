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
// Legacy exempt fields + proposal fields. saveEdit() posts the whole filing
// object, so every column is set from its current (possibly edited) value.
// Nullify an empty meeting_date so the DATE cast doesn't fail.
const meetingDate = data.meeting_date && String(data.meeting_date).trim() ? data.meeting_date : null;
await pool.query(
  `UPDATE filings SET
    memo_submitter = $1,
    company_name = $2,
    company_cik = $3,
    def14a_link = $4,
    item_number = $5,
    contact_name = $6,
    subject = $7,
    proposal_topic = $8,
    proposal_text = $9,
    meeting_date = $10,
    meeting_date_known = $11,
    proxy_status = $12
  WHERE id = $13`,
  [
    data.memo_submitter,
    data.company_name,
    data.company_cik,
    data.def14a_link,
    data.item_number,
    data.contact_name,
    data.subject,
    data.proposal_topic,
    data.proposal_text || null,
    meetingDate,
    data.meeting_date_known ?? false,
    data.proxy_status || null,
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
