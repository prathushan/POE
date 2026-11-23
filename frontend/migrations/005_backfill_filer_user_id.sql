-- 005_backfill_filer_user_id.sql
--
-- Purpose: link legacy / seeded proposals to the account that owns them.
--
-- Bug: proposals whose `filer_user_id` is NULL (seeded demo data, Phase 1
-- imports, or rows created before filer_user_id was populated) never appear in
-- the filer's "Link to Proposal" attach dropdown and never show the "Your
-- proposal" owner panel, because both match strictly on filer_user_id. The app
-- now has a runtime fallback (match the user's org_name to the proposal's
-- filer_name), but this migration makes the link permanent in the data so the
-- fallback is not relied on.
--
-- Safety:
--   * Only touches proposal rows (filing_type = 'proposal').
--   * Only touches rows where filer_user_id IS NULL (never overwrites an
--     existing owner).
--   * Only links when EXACTLY ONE user matches the filer_name (ambiguous
--     org names are left untouched and reported below for manual review).
--   * Case-insensitive, whitespace-trimmed match on org_name = filer_name.
--
-- Review the "ambiguous / unmatched" output before/after and link those by hand.

BEGIN;

-- 1) Backfill rows with a single unambiguous org match.
UPDATE filings f
SET filer_user_id = u.id
FROM users u
WHERE f.filing_type = 'proposal'
  AND f.filer_user_id IS NULL
  AND f.filer_name IS NOT NULL
  AND LOWER(TRIM(u.org_name)) = LOWER(TRIM(f.filer_name))
  AND (
    SELECT COUNT(*) FROM users u2
    WHERE LOWER(TRIM(u2.org_name)) = LOWER(TRIM(f.filer_name))
  ) = 1;

COMMIT;

-- 2) Report proposals still unlinked after the backfill (run manually to review):
--    - no user with a matching org_name, or
--    - more than one user shares that org_name (ambiguous — link by hand).
--
-- SELECT f.id, f.company_name, f.filer_name,
--        (SELECT COUNT(*) FROM users u WHERE LOWER(TRIM(u.org_name)) = LOWER(TRIM(f.filer_name))) AS org_matches
--   FROM filings f
--  WHERE f.filing_type = 'proposal' AND f.filer_user_id IS NULL
--  ORDER BY f.filer_name, f.id;
