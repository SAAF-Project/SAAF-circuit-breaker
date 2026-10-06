-- Additive, forward-only migration; existing demo/audit records are preserved.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS sentinel_sessions (
  id text PRIMARY KEY,
  active_prompt text NOT NULL,
  active_memory jsonb NOT NULL,
  checkpoint_prompt text NOT NULL,
  checkpoint_memory jsonb NOT NULL,
  trace jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
