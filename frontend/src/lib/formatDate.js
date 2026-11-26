// US month–day–year format, forced to en-US so it is consistent regardless of
// the viewer's browser locale (e.g. "11/12/2026") — avoids the DD/MM vs MM/DD
// ambiguity of the browser default.
export function fmtDate(d) {
  if (!d) return '—';
  // A date-only or ISO value ("2027-04-17" or "2027-04-17T00:00:00.000Z") is
  // formatted straight from the string so it never shifts a day across
  // timezones (the UTC bug) and renders identically on the server and client.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// Uploads are stored as "<Date.now()>-<original name>" (see saveFile). Strip that
// numeric prefix so viewers see the real filename, e.g.
// "1794928748745-26.GAP.CE Gap.pdf" -> "26.GAP.CE Gap.pdf".
export function cleanFileName(name) {
  return name ? String(name).replace(/^\d{10,}-/, '') : name;
}
