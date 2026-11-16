-- POE Phase 2 migration — proposal-centric model.
-- Additive & non-breaking: every new column is nullable or has a default,
-- so existing rows and data are untouched. Safe to run more than once.
BEGIN;

-- Filing type: proposal | no_action | exempt_solicitation
-- Existing rows default to 'exempt_solicitation' (Phase 1 records).
ALTER TABLE filings ADD COLUMN IF NOT EXISTS filing_type VARCHAR(20) DEFAULT 'exempt_solicitation';

-- Parent link (no-action / exempt attach to a proposal). NULL for proposals & legacy records.
ALTER TABLE filings ADD COLUMN IF NOT EXISTS proposal_id INTEGER;

-- Proposal fields
ALTER TABLE filings ADD COLUMN IF NOT EXISTS proposal_text TEXT;
ALTER TABLE filings ADD COLUMN IF NOT EXISTS proposal_topic VARCHAR(100);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS meeting_date DATE;
ALTER TABLE filings ADD COLUMN IF NOT EXISTS meeting_date_known BOOLEAN DEFAULT FALSE;
ALTER TABLE filings ADD COLUMN IF NOT EXISTS proxy_status VARCHAR(20);  -- included | excluded | withdrawn | NULL(not yet known)

-- No-action / exclusion fields
ALTER TABLE filings ADD COLUMN IF NOT EXISTS exclusion_basis VARCHAR(100);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS notice_date DATE;
ALTER TABLE filings ADD COLUMN IF NOT EXISTS company_letter_pdf_s3_key VARCHAR(500);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS company_letter_pdf_filename VARCHAR(255);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS response_pdf_s3_key VARCHAR(500);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS response_pdf_filename VARCHAR(255);

-- Denormalized flags for fast Yes/No columns on the public index
ALTER TABLE filings ADD COLUMN IF NOT EXISTS has_no_action BOOLEAN DEFAULT FALSE;
ALTER TABLE filings ADD COLUMN IF NOT EXISTS has_exempt_solicitation BOOLEAN DEFAULT FALSE;

-- Vote results (admin-entered post-AGM; hidden from public at launch)
ALTER TABLE filings ADD COLUMN IF NOT EXISTS vote_for DECIMAL(5,2);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS vote_against DECIMAL(5,2);
ALTER TABLE filings ADD COLUMN IF NOT EXISTS vote_abstain DECIMAL(5,2);

-- Self-referencing FK (added only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'filings_proposal_id_fkey'
  ) THEN
    ALTER TABLE filings
      ADD CONSTRAINT filings_proposal_id_fkey
      FOREIGN KEY (proposal_id) REFERENCES filings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_filings_filing_type ON filings(filing_type);
CREATE INDEX IF NOT EXISTS idx_filings_proposal_id ON filings(proposal_id);

-- Backfill: make sure any pre-existing rows are explicitly tagged.
UPDATE filings SET filing_type = 'exempt_solicitation' WHERE filing_type IS NULL;

COMMIT;
