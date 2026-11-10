import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const BOOTSTRAP_DDL = `
CREATE TABLE IF NOT EXISTS policies (
  id text PRIMARY KEY,
  policy_id text NOT NULL UNIQUE,
  genesis_prompt text NOT NULL,
  genesis_prompt_hash text NOT NULL,
  hard_rules jsonb NOT NULL,
  max_drift_threshold double precision NOT NULL DEFAULT 0.5,
  require_human_gate_above_eur double precision NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS personas (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL,
  faction text NOT NULL,
  description text NOT NULL,
  pressure_vector text NOT NULL,
  color text NOT NULL,
  initials text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id text PRIMARY KEY,
  ticket_number integer NOT NULL UNIQUE,
  customer_name text NOT NULL,
  city text NOT NULL,
  restaurant text NOT NULL,
  order_total double precision NOT NULL,
  requested_amount double precision NOT NULL,
  claim_type text NOT NULL,
  has_photo_evidence boolean NOT NULL,
  review_threat boolean NOT NULL,
  customer_message text NOT NULL,
  phase text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rehearsal_runs (
  id text PRIMARY KEY,
  mode text NOT NULL,
  status text NOT NULL,
  tickets_processed integer NOT NULL DEFAULT 0,
  refunds_against_policy integer NOT NULL DEFAULT 0,
  paid_against_policy_eur double precision NOT NULL DEFAULT 0,
  paid_compliant_eur double precision NOT NULL DEFAULT 0,
  quarantines integer NOT NULL DEFAULT 0,
  rollbacks integer NOT NULL DEFAULT 0,
  human_routes integer NOT NULL DEFAULT 0,
  max_drift_score double precision NOT NULL DEFAULT 0,
  final_drift_score double precision NOT NULL DEFAULT 0,
  merkle_root text,
  workpaper_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS ticket_events (
  id text PRIMARY KEY,
  run_id text NOT NULL,
  ticket_id text NOT NULL,
  ticket_number integer NOT NULL,
  proposed_amount double precision NOT NULL,
  paid_amount double precision NOT NULL DEFAULT 0,
  tool_name text NOT NULL,
  verdict text NOT NULL,
  reason text NOT NULL,
  drift_score double precision NOT NULL,
  instruction_drift double precision NOT NULL,
  memory_drift double precision NOT NULL,
  weakened_rules jsonb NOT NULL,
  action text NOT NULL,
  working_prompt text NOT NULL,
  working_prompt_hash text NOT NULL,
  memory_snapshot jsonb NOT NULL,
  lesson_written text,
  csat_score double precision NOT NULL,
  checkpoint_id text,
  rewrite_occurred boolean NOT NULL DEFAULT false,
  against_policy boolean NOT NULL DEFAULT false,
  step_hash text NOT NULL,
  parent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checkpoints (
  id text PRIMARY KEY,
  run_id text NOT NULL,
  checkpoint_key text NOT NULL,
  prompt_content text NOT NULL,
  prompt_hash text NOT NULL,
  memory_snapshot jsonb NOT NULL,
  healthy boolean NOT NULL,
  ticket_number integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workpapers (
  id text PRIMARY KEY,
  workpaper_id text NOT NULL UNIQUE,
  run_id text NOT NULL,
  audit_standard text NOT NULL,
  entity text NOT NULL,
  system_name text NOT NULL,
  genesis jsonb NOT NULL,
  trace jsonb NOT NULL,
  merkle_root text NOT NULL,
  audit_seal text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verification_result jsonb,
  html_report text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sentinel_sessions (
  id text PRIMARY KEY,
  active_prompt text NOT NULL,
  active_memory jsonb NOT NULL,
  checkpoint_prompt text NOT NULL,
  checkpoint_memory jsonb NOT NULL,
  trace jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS forge_scans (
  id text PRIMARY KEY,
  target_path text NOT NULL,
  language text NOT NULL,
  source_preview text NOT NULL,
  findings jsonb NOT NULL,
  red_flag_count integer NOT NULL,
  compiled_policy_id text,
  permissions_yaml text,
  agents_md text,
  jev_rules_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

const databaseUrl = process.env.DATABASE_URL;
const useExternalPostgres =
  typeof databaseUrl === "string" &&
  (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://"));

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPglite?: PGlite;
  __arenaNextJsPgliteReady?: Promise<void>;
  __arenaNextJsPgliteLock?: Promise<void>;
};

function createEmbeddedDb(): { pool: Pool; db: NodePgDatabase<typeof schema> } {
  const pglite = globalForDb.__arenaNextJsPglite ?? new PGlite();
  globalForDb.__arenaNextJsPglite = pglite;
  const ready =
    globalForDb.__arenaNextJsPgliteReady ??
    pglite.exec(BOOTSTRAP_DDL).then(() => undefined);
  globalForDb.__arenaNextJsPgliteReady = ready;

  const rawDb = drizzlePglite(pglite, { schema }) as unknown as NodePgDatabase<typeof schema>;
  const origTransaction = rawDb.transaction.bind(rawDb);
  rawDb.transaction = (async (...args: Parameters<typeof origTransaction>) => {
    await ready;
    const prev = globalForDb.__arenaNextJsPgliteLock ?? Promise.resolve();
    let release!: () => void;
    globalForDb.__arenaNextJsPgliteLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await origTransaction(...args);
    } finally {
      release();
    }
  }) as typeof rawDb.transaction;

  const compatPool = {
    end: async () => {
      await ready;
    },
    query: async (sqlText: string) => {
      await ready;
      return pglite.query(sqlText);
    },
  } as unknown as Pool;

  return { pool: compatPool, db: rawDb };
}

const instance = useExternalPostgres
  ? (() => {
      const pgPool =
        globalForDb.__arenaNextJsPostgresqlPool ??
        new Pool({
          connectionString: databaseUrl,
        });
      if (process.env.NODE_ENV !== "production") {
        globalForDb.__arenaNextJsPostgresqlPool = pgPool;
      }
      return { pool: pgPool, db: drizzleNodePg(pgPool, { schema }) };
    })()
  : createEmbeddedDb();

export const pool = instance.pool;
export const db = instance.db;
export { schema };

