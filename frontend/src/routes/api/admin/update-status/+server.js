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
       WHERE id = $3`,
      [status, note || null, id]
    );

    if (result.rowCount === 0) {
      return json({ message: 'Not found' }, { status: 404 });
    }

    return json({ success: true });

  } catch (err) {
    console.log('UPDATE ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};