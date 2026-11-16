import { json } from '@sveltejs/kit';
import pool from '$lib/server/db';

// Admin-only: record post-AGM vote results on a shareholder proposal.
// Hidden from the public submission form and index at launch (scope §5) — this
// endpoint just persists the three percentages so admin can enter them now.
export const POST = async ({ request }) => {
  try {
    const { id, vote_for, vote_against, vote_abstain } = await request.json();
    if (!id) return json({ message: 'Missing id' }, { status: 400 });

    // Blank string → NULL; otherwise validate 0–100.
    const toPct = (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > 100) return NaN;
      return n;
    };
    const vf = toPct(vote_for);
    const va = toPct(vote_against);
    const vab = toPct(vote_abstain);
    if ([vf, va, vab].some((n) => Number.isNaN(n))) {
      return json({ message: 'Percentages must be between 0 and 100' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE filings
          SET vote_for = $1, vote_against = $2, vote_abstain = $3
        WHERE id = $4 AND filing_type = 'proposal'
      RETURNING id, vote_for, vote_against, vote_abstain`,
      [vf, va, vab, id]
    );

    if (result.rowCount === 0) {
      return json({ message: 'Proposal not found' }, { status: 404 });
    }
    return json({ success: true, ...result.rows[0] });
  } catch (err) {
    console.log('VOTE RESULTS ERROR:', err);
    return json({ message: 'Server error' }, { status: 500 });
  }
};
