import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = 'static/uploads';

// Save an optional replacement PDF; returns { key, filename } or nulls.
function saveFile(file) {
  if (!file || typeof file === 'string' || file.size === 0) return Promise.resolve({ key: null, filename: null });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = Date.now() + '-' + file.name;
  const filepath = path.join(UPLOAD_DIR, filename);
  return file.arrayBuffer().then((buf) => {
    fs.writeFileSync(filepath, Buffer.from(buf));
    return { key: filepath.replace('static/', ''), filename };
  });
}

// Round-2 §7/§8: a filer edits one of their own submitted proposals.
// Updates in place (status unchanged) and reflects on the front end + admin.
export const POST = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return json({ message: 'Not authenticated' }, { status: 401 });

  try {
    const form = await request.formData();
    const id = form.get('id');
    if (!id) return json({ message: 'Missing proposal id' }, { status: 400 });

    // Ownership check — only the filer (or an admin) may edit.
    const r = await pool.query(
      `SELECT filer_user_id FROM filings WHERE id = $1 AND filing_type = 'proposal'`,
      [id]
    );
    const row = r.rows[0];
    if (!row) return json({ message: 'Proposal not found' }, { status: 404 });
    if (!user.is_admin && row.filer_user_id !== user.id) {
      return json({ message: 'Not your proposal' }, { status: 403 });
    }

    const company_name = form.get('company_name');
    const registrant_cik = form.get('registrant_cik');
    const proposal_topic = form.get('proposal_topic');
    const proposal_text = form.get('proposal_text') || null;
    const meeting_date = form.get('meeting_date') || null;
    const meeting_date_known = form.get('meeting_date_known') === 'true';
    const proxy_status = form.get('proxy_status') || null;
    if (!company_name || !registrant_cik || !proposal_topic || !meeting_date) {
      return json({ message: 'Missing required proposal fields' }, { status: 400 });
    }

    const primary = form.get('primary_file');
    const pdf = await saveFile(primary); // null key/filename when no new file uploaded

    await pool.query(
      `UPDATE filings
          SET company_name = $2::text, memo_submitter = $2::text, company_cik = $3,
              subject = $4::text, proposal_topic = $4::text, proposal_text = $5,
              meeting_date = $6, meeting_date_known = $7, proxy_status = $8,
              pdf_s3_key = COALESCE($9, pdf_s3_key),
              pdf_filename = COALESCE($10, pdf_filename)
        WHERE id = $1`,
      [id, company_name, registrant_cik, proposal_topic, proposal_text,
       meeting_date, meeting_date_known, proxy_status, pdf.key, pdf.filename]
    );
    return json({ success: true });
  } catch (err) {
    console.log('UPDATE-PROPOSAL ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
