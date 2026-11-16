-- Phase 2: self-service password reset (scope appendix Q10 = Yes)
-- Additive, non-breaking. Stores a SHA-256 hash of the reset token (never the raw token).
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
