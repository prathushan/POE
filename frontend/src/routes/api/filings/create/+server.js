// import { json } from '@sveltejs/kit';
// import { db } from '$lib/server/db';
// import fs from 'fs';
// import path from 'path';

// export const POST = async ({ request }) => {
//   console.log('🔥 API HIT');

//   try {
//     const formData = await request.formData();

//     const def14a_link = formData.get('def14a_link');
//     const item_number = formData.get('item_number') || null;
//     const subject = formData.get('subject');
//     const description = formData.get('description') || null;
//     const contact_name = formData.get('contact_name') || null;
//     const contact_cik = formData.get('contact_cik') || null;
//     const file = formData.get('file');

//     console.log('📥 FORM DATA:', {
//       def14a_link,
//       item_number,
//       subject,
//       description,
//       contact_name,
//       contact_cik,
//       file: file?.name
//     });

//    console.log('CHECK VALUES:', {
//   def14a_link,
//   subject,
//   file
// });

// if (!file || file.size === 0 || !subject?.trim() || !def14a_link?.trim()) {
//   console.log('❌ VALIDATION FAILED');

//   return json({ message: 'Missing required fields' }, { status: 400 });
// }

//     // 📦 SAVE FILE
//     const uploadDir = 'static/uploads';

//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     const buffer = Buffer.from(await file.arrayBuffer());
//     const filename = Date.now() + '-' + file.name;
//     const filepath = path.join(uploadDir, filename);

//     fs.writeFileSync(filepath, buffer);

//     console.log('📁 FILE SAVED:', filepath);

//     // 🔢 ACCESSION
//     const accession = 'PX-' + Date.now();

//     // 👤 USER
//     let user = {};
//     try {
//       user = JSON.parse(request.headers.get('x-user') || '{}');
//     } catch (e) {
//       console.log('⚠️ USER PARSE ERROR');
//     }

//     console.log('👤 USER:', user);

//     // 🛡️ SAFE USER FALLBACKS
//     const safeUser = {
//       id: user.id || null,
//       org_name: user.org_name || 'Unknown Company',
//       cik: user.cik || '',
//       email: user.email || 'test@example.com',
//       contact_name: user.contact_name || 'Unknown Contact'
//     };

//     console.log('🛡️ SAFE USER:', safeUser);

//     // 🚀 INSERT
//     console.log('🚀 INSERTING INTO DB...');

//     const [result] = await db.execute(
//       `INSERT INTO filings 
//       (accession_number, company_name, company_cik, def14a_link,
//        item_number, filer_user_id, filer_name, filer_cik,
//        contact_name, contact_cik, contact_email, pdf_s3_key, pdf_filename,
//        subject, description, status)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         accession,
//         safeUser.org_name,
//         safeUser.cik,
//         def14a_link,
//         item_number,
//         safeUser.id,
//         safeUser.org_name,
//         safeUser.cik,
//         contact_name || safeUser.contact_name,
//         contact_cik || safeUser.cik, // ✅ NEW FIELD
//         safeUser.email,
//         filepath,
//         filename,
//         subject,
//         description,
//         'pending'
//       ]
//     );

//     console.log('✅ INSERT SUCCESS:', result);

//     return json({ success: true });

//   } catch (err) {
//     console.log('❌ FULL ERROR:', err);

//     return json(
//       { message: err.message || 'Server error' },
//       { status: 500 }
//     );
//   }
// };

import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';
import fs from 'fs';
import path from 'path';

export const POST = async ({ request, locals }) => {
  console.log('🔥 API HIT');

  try {
    const formData = await request.formData();

    const def14a_link = formData.get('def14a_link');
    const item_number = formData.get('item_number') || null;
    const subject = formData.get('subject');
    const description = formData.get('description') || null;
    const contact_name = formData.get('contact_name') || null;
    const contact_cik = formData.get('contact_cik') || null;
    const file = formData.get('file');
    const memo_submitter = formData.get("memo_submitter");     


    console.log('📥 FORM DATA:', {
      def14a_link,
      item_number,
      subject,
      description,
      contact_name,
      contact_cik,
      memo_submitter,
      file: file?.name
    });

    if (!file || file.size === 0 || !subject?.trim() || !def14a_link?.trim()) {
      console.log('❌ VALIDATION FAILED');
      return json({ message: 'Missing required fields' }, { status: 400 });
    }

    if (!memo_submitter) {
      console.log('❌ VALIDATION FAILED'); 
  return json({ message: "Company name required" }, { status: 400 });
    }

    // 📦 SAVE FILE
    const uploadDir = 'static/uploads';

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = Date.now() + '-' + file.name;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, buffer);

    console.log('📁 FILE SAVED:', filepath);

    // 🔢 ACCESSION
    const accession = 'PX-' + Date.now();

    // 👤 USER
    // let user = {};
    // try {
    //   user = JSON.parse(request.headers.get('x-user') || '{}');
    //   console.log("USER HEADER:", request.headers.get('x-user'));
    // } catch (e) {
    //   console.log('⚠️ USER PARSE ERROR');
      
    // }

const user = locals.user;
 
if (!user) {
  return json({ message: 'Not authenticated' }, { status: 401 });
}

    const safeUser = {
      id: user.id || null,
      org_name: user.org_name || 'Unknown Company',
      cik: user.cik || '',
      email: user.email || 'test@example.com',
      contact_name: user.contact_name || 'Unknown Contact'
    };

    console.log('🚀 INSERTING INTO DB...');

    const result = await pool.query(
      `INSERT INTO filings 
      (accession_number, company_name, company_cik, def14a_link,
       item_number, filer_user_id, filer_name, filer_cik,memo_submitter,
       contact_name, contact_cik, contact_email, pdf_s3_key, pdf_filename,
       subject, description, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        accession,
        safeUser.org_name,
        safeUser.cik,
        def14a_link,
        item_number,
        safeUser.id,
        safeUser.org_name,
        safeUser.cik,

        memo_submitter,

        contact_name || safeUser.contact_name,
        contact_cik || safeUser.cik,
        safeUser.email,
        filepath,
        filename,
        subject,
        description,
        'pending'
      ]
    );

    console.log('✅ INSERT SUCCESS:', result.rowCount);

    return json({ success: true });

  } catch (err) {
    console.log('❌ FULL ERROR:', err);

    return json(
      { message: err.message || 'Server error' },
      { status: 500 }
    );
  }
};