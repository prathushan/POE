-- Phase 2: no-action filings may cite multiple exclusion bases (appendix Q7).
-- Widen exclusion_basis so it can hold a JSON array of bases. Existing single
-- string values stay valid and are read as a one-item list by parseBases().
ALTER TABLE filings ALTER COLUMN exclusion_basis TYPE TEXT;
