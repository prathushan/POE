import { redirect } from '@sveltejs/kit';

// Submitting now happens via the "Submit Filing" popup (SubmitFilingModal),
// opened from the header. This old page is retired — send visitors home.
// (This route will later become the "My Filings" page per Phase 2 scope.)
export const load = async () => {
  throw redirect(302, '/');
};
