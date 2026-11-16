import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = 'static/uploads';

// Save an uploaded File to static/uploads and return { key, filename }.
async function saveFile(file) {
  if (!file || typeof file === 'string' || file.size === 0) return { key: null, filename: null };
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = Date.now() + '-' + file.name;
  const filepath = path.join(UPLOAD_DIR, filename);
  const buf = await file.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buf));
  return { key: filepath.replace('static/', ''), filename };
}

// Admin-only: attach a no-action or exempt solicitation to ANY proposal (not
// restricted to the original filer). Inherits company/filer info from the parent
// proposal, publishes immediately (status 'approved'), and sets the parent flag.
export const POST = async ({ request }) => {
  try {
    const form = await request.formData();
    const mode = form.get('mode'); // 'no_action' | 'exempt'
    const proposal_id = form.get('proposal_id');
    if (!proposal_id) return json({ message: 'Missing proposal' }, { status: 400 });

    const pr = await pool.query(
      `SELECT id, company_name, company_cik, filer_user_id, filer_name, filer_cik,
              contact_name, contact_email
         FROM filings WHERE id = $1 AND filing_type = 'proposal'`,
      [proposal_id]
    );
    const parent = pr.rows[0];
    if (!parent) return json({ message: 'Proposal not found' }, { status: 404 });

    if (mode === 'no_action') {
      const exclusion_basis = form.get('exclusion_basis');
      const notice_date = form.get('notice_date') || null;
      if (!exclusion_basis) return json({ message: 'Missing exclusion basis' }, { status: 400 });

      const letter = await saveFile(form.get('company_letter_file'));
      const response = await saveFile(form.get('response_file'));

      await pool.query(
        `INSERT INTO filings
          (accession_number, filing_type, proposal_id, company_name, company_cik,
           filer_user_id, filer_name, filer_cik, contact_name, contact_email,
           exclusion_basis, notice_date,
           company_letter_pdf_s3_key, company_letter_pdf_filename,
           response_pdf_s3_key, response_pdf_filename, status, admin_note)
         VALUES ($1,'no_action',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'approved',$16)`,
        [
          'NA-' + Date.now(), proposal_id, parent.company_name, parent.company_cik,
          parent.filer_user_id, parent.filer_name, parent.filer_cik, parent.contact_name, parent.contact_email,
          exclusion_basis, notice_date,
          letter.key, letter.filename, response.key, response.filename,
          'Attached by administrator',
        ]
      );
      await pool.query(`UPDATE filings SET has_no_action = true WHERE id = $1`, [proposal_id]);
      return json({ success: true, filing_type: 'no_action', proposal_id });
    }

    if (mode === 'exempt') {
      const def14a_link = form.get('def14a_link') || null;
      const item_number = form.get('item_number') || null;
      const voluntary = form.get('voluntary_5m') === 'true';
      const primary = form.get('primary_file');
      if (!primary || primary.size === 0) {
        return json({ message: 'Exempt solicitation PDF is required' }, { status: 400 });
      }
      const pdf = await saveFile(primary);
      await pool.query(
        `INSERT INTO filings
          (accession_number, filing_type, proposal_id, company_name, company_cik,
           filer_user_id, filer_name, filer_cik, contact_name, contact_email,
           def14a_link, item_number, voluntary_filing, pdf_s3_key, pdf_filename, status, admin_note)
         VALUES ($1,'exempt_solicitation',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'approved',$15)`,
        [
          'ES-' + Date.now(), proposal_id, parent.company_name, parent.company_cik,
          parent.filer_user_id, parent.filer_name, parent.filer_cik, parent.contact_name, parent.contact_email,
          def14a_link, item_number, voluntary, pdf.key, pdf.filename,
          'Attached by administrator',
        ]
      );
      await pool.query(`UPDATE filings SET has_exempt_solicitation = true WHERE id = $1`, [proposal_id]);
      return json({ success: true, filing_type: 'exempt_solicitation', proposal_id });
    }

    return json({ message: 'Invalid mode' }, { status: 400 });
  } catch (err) {
    console.log('ADMIN ATTACH ERROR:', err);
    return json({ message: err.message || 'Server error' }, { status: 500 });
  }
};
