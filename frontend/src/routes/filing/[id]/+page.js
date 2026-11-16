import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
  try {
    const res = await fetch('/api/filings/public');
    if (!res.ok) throw error(500, 'Failed to fetch filings');

    const filings = await res.json();
    const clicked = filings.find((f) => String(f.id) === String(params.id));
    if (!clicked) throw error(404, 'Filing not found');

    // Legacy standalone exempt solicitation (no parent) → simple view.
    const isLegacy =
      clicked.filing_type === 'exempt_solicitation' && !clicked.proposal_id;

    if (isLegacy) {
      return { record: clicked, exempt: null, noAction: null, isLegacy: true };
    }

    // Otherwise resolve to the parent proposal and gather its attachments.
    const proposal =
      clicked.filing_type === 'proposal'
        ? clicked
        : filings.find((f) => String(f.id) === String(clicked.proposal_id)) || clicked;

    const exempt = filings.find(
      (f) => String(f.proposal_id) === String(proposal.id) && f.filing_type === 'exempt_solicitation'
    ) || null;
    const noAction = filings.find(
      (f) => String(f.proposal_id) === String(proposal.id) && f.filing_type === 'no_action'
    ) || null;

    return { record: proposal, exempt, noAction, isLegacy: false };
  } catch (err) {
    if (err?.status) throw err;
    console.error('LOAD ERROR:', err);
    throw error(500, 'Server load error');
  }
}
