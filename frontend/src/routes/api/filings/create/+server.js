import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = 'static/uploads';

// Save an uploaded File to static/uploads and return { key, filename }.
function saveFile(file) {
  if (!file || typeof file === 'string' || file.size === 0) return { key: null, filename: null };
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = Date.now() + '-' + file.name;
  const filepath = path.join(UPLOAD_DIR, filename);
  return file.arrayBuffer().then((buf) => {
    fs.writeFileSync(filepath, Buffer.from(buf));
    return { key: filepath.replace('static/', ''), filename };
  });
}

export const POST = async ({ request, locals }) => {
  try {
    const form = await request.formData();
    const mode = form.get('mode') || 'standalone';
    const user = locals.user;
    if (!user) return json({ message: 'Not authenticated' }, { status: 401 });

    // ─────────────────────────── NEW PROPOSAL ───────────────────────────
    if (mode === 'new') {
      const company_name = form.get('company_name');
      const registrant_cik = form.get('registrant_cik');
      const proposal_topic = form.get('proposal_topic');
      const proposal_text = form.get('proposal_text') || null;
      const meeting_date = form.get('meeting_date') || null;
      const meeting_date_known = form.get('meeting_date_known') === 'true';
      const proxy_status = form.get('proxy_status') || null;
      const proxy_preview_interest = form.get('proxy_preview_interest') === 'true';
      const primary = form.get('primary_file');

      if (!company_name || !registrant_cik || !proposal_topic || !meeting_date || !primary || primary.size === 0) {
        return json({ message: 'Missing required proposal fields or supporting PDF' }, { status: 400 });
      }
      const pdf = await saveFile(primary);

      await pool.query(
        `INSERT INTO filings
          (accession_number, filing_type, company_name, company_cik, memo_submitter,
           filer_user_id, filer_name, filer_cik, contact_name, contact_cik, contact_email,
           subject, proposal_topic, proposal_text, meeting_date, meeting_date_known, proxy_status, proxy_preview_interest,
           pdf_s3_key, pdf_filename, status)
         VALUES ($1,'proposal',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending')`,
        [
          'PROP-' + Date.now(), company_name, registrant_cik, company_name,
          user.id, user.org_name, user.cik, user.contact_name || '-', user.cik, user.email,
          proposal_topic, proposal_topic, proposal_text, meeting_date, meeting_date_known, proxy_status, proxy_preview_interest,
          pdf.key, pdf.filename,
        ]
      );
      return json({ success: true, filing_type: 'proposal' });
    }

    // ───────────────────── ATTACH: NO-ACTION / EXCLUSION ─────────────────────
    if (mode === 'no_action') {
      const proposal_id = form.get('proposal_id');
      const exclusion_basis = form.get('exclusion_basis');
      const notice_date = form.get('notice_date') || null;
      if (!proposal_id || !exclusion_basis) {
        return json({ message: 'Missing proposal or exclusion basis' }, { status: 400 });
      }
      const parent = await ownedProposal(proposal_id, user);
      if (!parent) return json({ message: 'Proposal not found or not yours' }, { status: 403 });

      const letter = await saveFile(form.get('company_letter_file'));
      const response = await saveFile(form.get('response_file'));

      await pool.query(
        `INSERT INTO filings
          (accession_number, filing_type, proposal_id, company_name, company_cik,
           filer_user_id, filer_name, filer_cik, contact_email,
           exclusion_basis, notice_date,
           company_letter_pdf_s3_key, company_letter_pdf_filename,
           response_pdf_s3_key, response_pdf_filename, status)
         VALUES ($1,'no_action',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'approved')`,
        [
          'NA-' + Date.now(), proposal_id, parent.company_name, parent.company_cik,
          user.id, user.org_name, user.cik, user.email,
          exclusion_basis, notice_date,
          letter.key, letter.filename, response.key, response.filename,
        ]
      );
      // Attachments publish immediately (scope §2/§5) — set the parent flag now.
      await pool.query(`UPDATE filings SET has_no_action = true WHERE id = $1`, [proposal_id]);
      return json({ success: true, filing_type: 'no_action' });
    }

    // ───────────────────── ATTACH: EXEMPT SOLICITATION ─────────────────────
    if (mode === 'exempt') {
      const proposal_id = form.get('proposal_id');
      const def14a_link = form.get('def14a_link') || null;
      const item_number = form.get('item_number') || null;
      const voluntary = form.get('voluntary_5m') === 'true';
      const agm_date = form.get('agm_date') || null; // round-2 §6: optionally confirm the proposal's AGM
      const primary = form.get('primary_file');
      if (!proposal_id || !primary || primary.size === 0) {
        return json({ message: 'Missing proposal or exempt solicitation PDF' }, { status: 400 });
      }
      const parent = await ownedProposal(proposal_id, user);
      if (!parent) return json({ message: 'Proposal not found or not yours' }, { status: 403 });

      const pdf = await saveFile(primary);
      await pool.query(
        `INSERT INTO filings
          (accession_number, filing_type, proposal_id, company_name, company_cik,
           filer_user_id, filer_name, filer_cik, contact_email,
           def14a_link, item_number, voluntary_filing, pdf_s3_key, pdf_filename, status)
         VALUES ($1,'exempt_solicitation',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved')`,
        [
          'ES-' + Date.now(), proposal_id, parent.company_name, parent.company_cik,
          user.id, user.org_name, user.cik, user.email,
          def14a_link, item_number, voluntary, pdf.key, pdf.filename,
        ]
      );
      // Attachments publish immediately (scope §2/§5) — set the parent flag now.
      await pool.query(`UPDATE filings SET has_exempt_solicitation = true WHERE id = $1`, [proposal_id]);
      // round-2 §6: if an AGM date was supplied, confirm it on the parent proposal.
      if (agm_date) {
        await pool.query(
          `UPDATE filings SET meeting_date = $1, meeting_date_known = true WHERE id = $2`,
          [agm_date, proposal_id]
        );
      }
      return json({ success: true, filing_type: 'exempt_solicitation' });
    }

    // ───────────────────── STANDALONE (legacy exempt sol) ─────────────────────
    const def14a_link = form.get('def14a_link');
    const company_name = form.get('company_name');
    const subject = form.get('subject');
    const item_number = form.get('item_number') || null;
    const contact_name = form.get('contact_name') || null;
    const voluntary = form.get('voluntary_5m') === 'true';
    const primary = form.get('primary_file');
    if (!def14a_link || !subject || !primary || primary.size === 0) {
      return json({ message: 'Missing required fields' }, { status: 400 });
    }
    const pdf = await saveFile(primary);
    await pool.query(
      `INSERT INTO filings
        (accession_number, filing_type, company_name, company_cik, def14a_link, item_number,
         filer_user_id, filer_name, filer_cik, memo_submitter,
         contact_name, contact_cik, contact_email, voluntary_filing,
         pdf_s3_key, pdf_filename, subject, status)
       VALUES ($1,'exempt_solicitation',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending')`,
      [
        'PX-' + Date.now(), user.org_name, user.cik, def14a_link, item_number,
        user.id, user.org_name, user.cik, company_name,
        contact_name || '-', user.cik, user.email, voluntary,
        pdf.key, pdf.filename, subject,
      ]
    );
    return json({ success: true, filing_type: 'exempt_solicitation' });
  } catch (err) {
    console.log('CREATE ERROR:', err);
    return json({ message: err.message || 'Server error' }, { status: 500 });
  }
};

// Fetch a proposal only if it belongs to this user (or user is admin).
async function ownedProposal(id, user) {
  const r = await pool.query(
    `SELECT id, company_name, company_cik, filer_user_id FROM filings
      WHERE id = $1 AND filing_type = 'proposal'`,
    [id]
  );
  const p = r.rows[0];
  if (!p) return null;
  if (user.is_admin || p.filer_user_id === user.id) return p;
  return null;
}
