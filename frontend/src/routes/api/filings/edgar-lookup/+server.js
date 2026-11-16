import { json } from '@sveltejs/kit';

// Optional EDGAR company lookup (scope §8). Lets the Company Name field also
// surface registrants that aren't on POE yet, auto-filling their 10-digit CIK
// from the SEC's public company_tickers.json. Cached in memory (24h) so the
// ~1MB file is fetched at most once a day, and searched server-side.
let CACHE = null;
let CACHE_TIME = 0;
const TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getTickers() {
  if (CACHE && Date.now() - CACHE_TIME < TTL) return CACHE;
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    // SEC requires a descriptive User-Agent with contact info.
    headers: { 'User-Agent': 'Proxy Open Exchange (proxyopenexchange.org)' },
  });
  if (!res.ok) throw new Error('SEC fetch failed: ' + res.status);
  const data = await res.json();
  CACHE = Object.values(data).map((e) => ({
    company_name: e.title,
    company_cik: String(e.cik_str).padStart(10, '0'),
    ticker: e.ticker,
  }));
  CACHE_TIME = Date.now();
  return CACHE;
}

export const GET = async ({ url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  if (q.length < 2) return json([]);
  try {
    const all = await getTickers();
    const starts = [];
    const contains = [];
    for (const c of all) {
      const name = c.company_name.toLowerCase();
      if (name.startsWith(q)) starts.push(c);
      else if (name.includes(q)) contains.push(c);
      if (starts.length >= 8) break;
    }
    return json([...starts, ...contains].slice(0, 8));
  } catch (err) {
    console.log('EDGAR LOOKUP ERROR:', err);
    // Fail soft — the form still works with POE-only companies.
    return json([]);
  }
};
