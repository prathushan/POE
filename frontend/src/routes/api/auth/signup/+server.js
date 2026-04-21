// 

import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import pool from '$lib/server/db';

export const POST = async ({ request }) => {
  const {
    email,
    password,
    cik,
    filer_name,
    contact_name
  } = await request.json();

  if (!email || !password || !cik || !contact_name) {
    return json({ message: 'All required fields must be filled' }, { status: 400 });
  }

  const formattedCIK = cik.padStart(10, '0');

  // 🚫 Block personal emails
  const blocked = [
    'gmail.com','yahoo.com','hotmail.com','outlook.com',
    'aol.com','icloud.com','mail.com','protonmail.com'
  ];

  const domain = email.split('@')[1];

  if (blocked.includes(domain)) {
    return json({ message: 'Use company email' }, { status: 400 });
  }

  // 🔍 CHECK EXISTING USER
  // const existingResult = await pool.query(
  //   'SELECT * FROM users WHERE email = $1 OR cik = $2',
  //   [email, formattedCIK]
  // );

//   const existing = await pool.query(
//   "SELECT * FROM users WHERE email = $1",
//   [email]
// );
 
// if (existing.rows.length > 0) {
//   return json({ message: "Email already registered. Please sign in." }, { status: 400 });
// }

//   if (existingResult.rows.length > 0) {
//     return json(
//       { message: 'Matched record already exists. Please sign in instead.' },
//       { status: 400 }
//     );
//   }

// 🔍 CHECK EXISTING USER (ONLY EMAIL)

const existing = await pool.query(

  "SELECT * FROM users WHERE email = $1",

  [email]

);
 
if (existing.rows.length > 0) {

  return json(

    { message: "Email already registered. Please sign in." },

    { status: 400 }

  );

}
 
// 🔥 LIMIT USERS PER CIK (MAX 5)

const count = await pool.query(

  "SELECT COUNT(*) FROM users WHERE cik = $1",

  [formattedCIK]

);
 
if (parseInt(count.rows[0].count) >= 5) {

  return json(

    { message: "Maximum 5 members allowed per organization" },

    { status: 400 }

  );

}
 



  // 🔍 CIK lookup
  const cikResult = await pool.query(
    'SELECT org_name FROM cik_registry WHERE cik = $1',
    [formattedCIK]
  );

  let finalOrg = '';
  let verified = false;

  if (cikResult.rows.length > 0) {
    finalOrg = cikResult.rows[0].org_name;
    verified = true;
  } else {
    finalOrg = filer_name;
  }

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users 
    (org_name, cik, email, contact_name, password_hash, verified)
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [finalOrg, formattedCIK, email, contact_name, hash, verified]
  );

  return json({ success: true, org_name: finalOrg });
};