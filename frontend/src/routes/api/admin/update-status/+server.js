// import { json } from '@sveltejs/kit';
// import { db } from '$lib/server/db';

// export const POST = async ({ request }) => {
//   try {
//     const { id, status, note } = await request.json();

//     await db.execute(
//       `UPDATE filings 
//        SET status = ?, admin_note = ?
//        WHERE id = ?`,
//       [status, note || null, id]
//     );

//     return json({ success: true });

//   } catch (err) {
//     console.log('UPDATE ERROR:', err);
//     return json({ message: 'Server error' }, { status: 500 });
//   }
// };

import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

export const POST = async ({ request }) => {
  try {
    const { id, status, note } = await request.json();

    const result = await pool.query(
      `UPDATE filings
       SET status = $1, admin_note = $2
       WHERE id = $3
       RETURNING filing_type, proposal_id`,
      [status, note || null, id]
    );

    if (result.rowCount === 0) {
      return json({ message: 'Not found' }, { status: 404 });
    }

    // If this row is an attachment, recompute the parent proposal's Yes/No flags
    // from whichever attachments are currently APPROVED.
    const { proposal_id } = result.rows[0];
    if (proposal_id) {
      await pool.query(
        `UPDATE filings p SET
           has_no_action = EXISTS (
             SELECT 1 FROM filings c
              WHERE c.proposal_id = p.id AND c.filing_type = 'no_action'
                AND LOWER(c.status) = 'approved'),
           has_exempt_solicitation = EXISTS (
             SELECT 1 FROM filings c
              WHERE c.proposal_id = p.id AND c.filing_type = 'exempt_solicitation'
                AND LOWER(c.status) = 'approved')
         WHERE p.id = $1`,
        [proposal_id]
      );
    }

    return json({ success: true });

  } catch (err) {
    console.log('UPDATE ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};