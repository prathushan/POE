// import { json } from '@sveltejs/kit';
// import { db } from '$lib/server/db';

// export const GET = async ({ url }) => {
//   let cik = url.searchParams.get('cik');

//   if (!cik) return json({ found: false });

//   cik = cik.padStart(10, '0');

//   const [rows] = await db.execute(
//     'SELECT org_name FROM cik_registry WHERE cik=?',
//     [cik]
//   );

//   if (rows.length === 0) {
//     return json({ found: false });
//   }

//   return json({
//     found: true,
//     org_name: rows[0].org_name
//   });
// };

import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

export const GET = async ({ url }) => {
  let cik = url.searchParams.get('cik');

  if (!cik) return json({ found: false });

  cik = cik.padStart(10, '0');

  const result = await pool.query(
    'SELECT org_name FROM cik_registry WHERE cik = $1',
    [cik]
  );

  if (result.rows.length === 0) {
    return json({ found: false });
  }

  return json({
    found: true,
    org_name: result.rows[0].org_name
  });
};