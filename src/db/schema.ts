import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  policyId: text("policy_id").notNull().unique(),
  genesisPrompt: text("genesis_prompt").notNull(),
  genesisPromptHash: text("genesis_prompt_hash").notNull(),
  hardRules: jsonb("hard_rules")
    .$type<{
      maxUnapprovedAmountEur: number;
      capToOrderValue: boolean;
      requireVerifiedEvidence: boolean;
      filterReviewBlackmail: boolean;
    }>()
    .notNull(),
  maxDriftThreshold: doublePrecision("max_drift_threshold").notNull().default(0.5),
  requireHumanGateAboveEur: doublePrecision("require_human_gate_above_eur")
    .notNull()
    .default(20),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const personas = pgTable("personas", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  faction: text("faction").notNull(),
  description: text("description").notNull(),
  pressureVector: text("pressure_vector").notNull(),
  color: text("color").notNull(),
  initials: text("initials").notNull(),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
});

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  ticketNumber: integer("ticket_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  city: text("city").notNull(),
  restaurant: text("restaurant").notNull(),
  orderTotal: doublePrecision("order_total").notNull(),
  requestedAmount: doublePrecision("requested_amount").notNull(),
  claimType: text("claim_type").notNull(),
  hasPhotoEvidence: boolean("has_photo_evidence").notNull(),
  reviewThreat: boolean("review_threat").notNull(),
  customerMessage: text("customer_message").notNull(),
  phase: text("phase").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rehearsalRuns = pgTable("rehearsal_runs", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  ticketsProcessed: integer("tickets_processed").notNull().default(0),
  refundsAgainstPolicy: integer("refunds_against_policy").notNull().default(0),
  paidAgainstPolicyEur: doublePrecision("paid_against_policy_eur").notNull().default(0),
  paidCompliantEur: doublePrecision("paid_compliant_eur").notNull().default(0),
  quarantines: integer("quarantines").notNull().default(0),
  rollbacks: integer("rollbacks").notNull().default(0),
  humanRoutes: integer("human_routes").notNull().default(0),
  maxDriftScore: doublePrecision("max_drift_score").notNull().default(0),
  finalDriftScore: doublePrecision("final_drift_score").notNull().default(0),
  merkleRoot: text("merkle_root"),
  workpaperId: text("workpaper_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const ticketEvents = pgTable("ticket_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  ticketId: text("ticket_id").notNull(),
  ticketNumber: integer("ticket_number").notNull(),
  proposedAmount: doublePrecision("proposed_amount").notNull(),
  paidAmount: doublePrecision("paid_amount").notNull().default(0),
  toolName: text("tool_name").notNull(),
  verdict: text("verdict").notNull(),
  reason: text("reason").notNull(),
  driftScore: doublePrecision("drift_score").notNull(),
  instructionDrift: doublePrecision("instruction_drift").notNull(),
  memoryDrift: doublePrecision("memory_drift").notNull(),
  weakenedRules: jsonb("weakened_rules").$type<string[]>().notNull(),
  action: text("action").notNull(),
  workingPrompt: text("working_prompt").notNull(),
  workingPromptHash: text("working_prompt_hash").notNull(),
  memorySnapshot: jsonb("memory_snapshot").$type<string[]>().notNull(),
  lessonWritten: text("lesson_written"),
  csatScore: doublePrecision("csat_score").notNull(),
  checkpointId: text("checkpoint_id"),
  rewriteOccurred: boolean("rewrite_occurred").notNull().default(false),
  againstPolicy: boolean("against_policy").notNull().default(false),
  stepHash: text("step_hash").notNull(),
  parentHash: text("parent_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const checkpoints = pgTable("checkpoints", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  checkpointKey: text("checkpoint_key").notNull(),
  promptContent: text("prompt_content").notNull(),
  promptHash: text("prompt_hash").notNull(),
  memorySnapshot: jsonb("memory_snapshot").$type<string[]>().notNull(),
  healthy: boolean("healthy").notNull(),
  ticketNumber: integer("ticket_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workpapers = pgTable("workpapers", {
  id: text("id").primaryKey(),
  workpaperId: text("workpaper_id").notNull().unique(),
  runId: text("run_id").notNull(),
  auditStandard: text("audit_standard").notNull(),
  entity: text("entity").notNull(),
  systemName: text("system_name").notNull(),
  genesis: jsonb("genesis").$type<Record<string, unknown>>().notNull(),
  trace: jsonb("trace").$type<Record<string, unknown>[]>().notNull(),
  merkleRoot: text("merkle_root").notNull(),
  auditSeal: text("audit_seal").notNull(),
  verified: boolean("verified").notNull().default(false),
  verificationResult: jsonb("verification_result").$type<Record<string, unknown>>(),
  htmlReport: text("html_report"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sentinelSessions = pgTable("sentinel_sessions", {
  id: text("id").primaryKey(),
  activePrompt: text("active_prompt").notNull(),
  activeMemory: jsonb("active_memory").$type<string[]>().notNull(),
  checkpointPrompt: text("checkpoint_prompt").notNull(),
  checkpointMemory: jsonb("checkpoint_memory").$type<string[]>().notNull(),
  trace: jsonb("trace").$type<Record<string, unknown>[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const forgeScans = pgTable("forge_scans", {
  id: text("id").primaryKey(),
  targetPath: text("target_path").notNull(),
  language: text("language").notNull(),
  sourcePreview: text("source_preview").notNull(),
  findings: jsonb("findings")
    .$type<
      {
        flag: string;
        severity: string;
        title: string;
        detail: string;
        line: number;
        snippet: string;
      }[]
    >()
    .notNull(),
  redFlagCount: integer("red_flag_count").notNull(),
  compiledPolicyId: text("compiled_policy_id"),
  permissionsYaml: text("permissions_yaml"),
  agentsMd: text("agents_md"),
  jevRulesJson: jsonb("jev_rules_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
