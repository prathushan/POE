// Plain-language Rule 14a-8(i) exclusion categories (scope §3).
export const EXCLUSION_BASES = [
  "(i)(1) — Improper under state law",
  "(i)(2) — Would cause company to violate law",
  "(i)(3) — Violation of proxy rules",
  "(i)(4) — Personal grievance",
  "(i)(5) — Relevance (less than 5% of assets)",
  "(i)(6) — Company lacks authority to implement",
  "(i)(7) — Relates to ordinary business / management functions",
  "(i)(8) — Relates to board election",
  "(i)(9) — Conflicts with company's own proposal",
  "(i)(10) — Substantially implemented",
  "(i)(11) — Duplication",
  "(i)(12) — Resubmission (below vote threshold)",
  "(i)(13) — Specific amount of dividends",
  "Unknown",
];

// A no-action filing may cite MULTIPLE exclusion bases. They are stored as a
// JSON array string. This parses a stored value into an array, tolerating the
// legacy format where a single basis was stored as a plain string.
export function parseBases(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  const s = String(val).trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch {
      /* fall through to treat as a single plain-string basis */
    }
  }
  return [s];
}
