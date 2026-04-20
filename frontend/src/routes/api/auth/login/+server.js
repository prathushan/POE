// import bcrypt from 'bcryptjs';
// import { db } from '$lib/server/db';
// import { json } from '@sveltejs/kit';

// export const POST = async ({ request }) => {
//   const { email, password } = await request.json();

//   const [rows] = await db.execute(
//     'SELECT * FROM users WHERE email=?',
//     [email]
//   );

//   if (rows.length === 0) {
//     return json({ message: 'User not found' }, { status: 400 });
//   }

//   const user = rows[0];

//   const valid = await bcrypt.compare(password, user.password_hash);

//   if (!valid) {
//     return json({ message: 'Wrong password' }, { status: 400 });
//   }

//   // ✅ IMPORTANT: send user data
//   return json({
//   success: true,
//   user: {
//     id: user.id,
//     email: user.email,
//     org_name: user.org_name,
//     cik: user.cik,
//     contact_name: user.contact_name
//   }
// });
// };

/////////////////////////////////////////////////////////////

// import bcrypt from 'bcryptjs';
// import pool from '$lib/server/db';
// import { json } from '@sveltejs/kit';

// export const POST = async ({ request }) => {
//   const { email, password } = await request.json();

//   const result = await pool.query(
//     'SELECT * FROM users WHERE email = $1',
//     [email]
//   );

//   if (result.rows.length === 0) {
//     return json({ message: 'User not found' }, { status: 400 });
//   }

//   const user = result.rows[0];

//   const valid = await bcrypt.compare(password, user.password_hash);

//   if (!valid) {
//     return json({ message: 'Wrong password' }, { status: 400 });
//   }

//   return json({
//     success: true,
//     user: {
//       id: user.id,
//       email: user.email,
//       org_name: user.org_name,
//       cik: user.cik,
//       contact_name: user.contact_name
//     }
//   });
// };

/////////////////////////////////////////////////////////////////////////////////////////////////////


import bcrypt from 'bcryptjs';

import pool from '$lib/server/db';

import { json } from '@sveltejs/kit';
 
export const POST = async ({ request, cookies }) => {

  try {

    const { email, password } = await request.json();
 
    if (!email || !password) {

      return json({ message: 'Missing fields' }, { status: 400 });

    }
 
    const result = await pool.query(

      'SELECT * FROM users WHERE email = $1',

      [email]

    );
 
    if (result.rows.length === 0) {

      return json({ message: 'User not found' }, { status: 400 });

    }
 
    const user = result.rows[0];
 
    const valid = await bcrypt.compare(password, user.password_hash);
 
    if (!valid) {

      return json({ message: 'Wrong password' }, { status: 400 });

    }
 
    // ✅ SET COOKIE (THIS IS THE NEW PART)

   

// 🔥 CLEAR OLD COOKIE FIRST
cookies.set('user', '', {
  path: '/',
  expires: new Date(0)
});
 
// ✅ SET NEW COOKIE
cookies.set(
  'user',
  JSON.stringify({
    id: user.id,
    org_name: user.org_name,
    cik: user.cik,
    email: user.email,
    contact_name: user.contact_name
  }),
  {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: 60 * 60 * 24
  }
);
 
    // ✅ Still return user (optional but useful)

    return json({

      success: true,

      user: {

        id: user.id,

        email: user.email,

        org_name: user.org_name,

        cik: user.cik,

        contact_name: user.contact_name

      }

    });
 
  } catch (err) {

    console.error("LOGIN ERROR:", err);

    return json({ message: 'Server error' }, { status: 500 });

  }

};
 