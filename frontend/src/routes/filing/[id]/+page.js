import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
  try {
    const res = await fetch('/api/filings/public');

    if (!res.ok) {
      throw error(500, 'Failed to fetch filings');
    }

    const filings = await res.json();

    const filing = filings.find(
      (f) => String(f.id) === String(params.id)
    );

    if (!filing) {
      throw error(404, 'Filing not found');
    }

    return {
      filing
    };

  } catch (err) {
    console.error('LOAD ERROR:', err);

    throw error(500, 'Server load error');
  }
}



