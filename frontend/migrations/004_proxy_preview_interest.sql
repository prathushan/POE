-- Round 2 §5: filer flags interest in Proxy Preview 2027 at submission time.
-- Admins can then see/sort which proposals are interested.
-- Additive, non-breaking.
ALTER TABLE filings
  ADD COLUMN IF NOT EXISTS proxy_preview_interest BOOLEAN NOT NULL DEFAULT false;
