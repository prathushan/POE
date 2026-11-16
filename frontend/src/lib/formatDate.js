// US month–day–year format, forced to en-US so it is consistent regardless of
// the viewer's browser locale (e.g. "11/12/2026") — avoids the DD/MM vs MM/DD
// ambiguity of the browser default.
export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
