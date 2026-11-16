import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Admin-only: remove a no-action or exempt-solicitation document that is
// attached to a proposal. The attachment is a child row (proposal_id → parent);
// removing it soft-deletes that child row and recomputes the parent proposal's
// Yes/No flags. The parent proposal itself is never deleted.
export const POST = async ({ request }) => {
  try {
    const { id } = await request.json();
    if (!id) return json({ message: 'Missing id' }, { status: 400 });

    // Only allow removing actual attachments (must have a parent proposal and
    // be a no_action / exempt_solicitation row — never a proposal or legacy record).
    const result = await pool.query(
      `UPDATE filings
          SET status = 'deleted'
        WHERE id = $1
          AND proposal_id IS NOT NULL
          AND filing_type IN ('no_action', 'exempt_solicitation')
      RETURNING proposal_id, filing_type`,
      [id]
    );

    if (result.rowCount === 0) {
      return json({ message: 'Not an attachment, or not found' }, { status: 404 });
    }

    const { proposal_id } = result.rows[0];

    // Recompute the parent proposal's denormalized Yes/No flags from the
    // attachments that still exist (not removed). This clears only the flag for
    // the document just removed and leaves the other type untouched.
    await pool.query(
      `UPDATE filings p SET
         has_no_action = EXISTS (
           SELECT 1 FROM filings c
            WHERE c.proposal_id = p.id AND c.filing_type = 'no_action'
              AND c.status <> 'deleted'),
         has_exempt_solicitation = EXISTS (
           SELECT 1 FROM filings c
            WHERE c.proposal_id = p.id AND c.filing_type = 'exempt_solicitation'
              AND c.status <> 'deleted')
       WHERE p.id = $1`,
      [proposal_id]
    );

    return json({ success: true, proposal_id });
  } catch (err) {
    console.log('REMOVE ATTACHMENT ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
