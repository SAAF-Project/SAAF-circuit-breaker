import { JET_HARD_RULES, HUMAN_GATE_EUR, MAX_DRIFT_THRESHOLD } from "@/lib/genesis";
export type RedFlagCode =
  | "CAN_EDIT_ITSELF"
  | "RULES_ONLY_IN_PROMPT"
  | "TARGET_IN_CONTEXT"
  | "SOFTENING_LANGUAGE"
  | "ESCALATIONS_FALLING"
  | "NO_REPLAYABLE_LOG";

export type RedFlagFinding = {
  flag: RedFlagCode;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  line: number;
  snippet: string;
};

export const RED_FLAG_CATALOG: Record<
  RedFlagCode,
  { title: string; why: string; severity: RedFlagFinding["severity"] }
> = {
  CAN_EDIT_ITSELF: {
    title: "Self-editing loop",
    why: "Writable prompt, memory buffer, or tool registry inside the execution loop. The agent can rewrite the policy that was supposed to constrain it.",
    severity: "critical",
  },
  RULES_ONLY_IN_PROMPT: {
    title: "Guard enforcement needs verification",
    why: "Business thresholds appear in source text. This heuristic scan cannot prove that every execution path enforces them, even when guard symbols are present.",
    severity: "critical",
  },
  TARGET_IN_CONTEXT: {
    title: "Proxy target in working context",
    why: "CSAT / conversion / rank scores sit in the prompt without a balancing control. The metric rewards what the policy forbids.",
    severity: "high",
  },
  SOFTENING_LANGUAGE: {
    title: "Softening hedges",
    why: "Prompt templates or memory accumulators use hedges that dissolve hard rules: generously, plausible, guidelines, never deny.",
    severity: "high",
  },
  ESCALATIONS_FALLING: {
    title: "Escalations discouraged",
    why: "Instructions reward autonomous closures and tell the agent not to bother a human.",
    severity: "high",
  },
  NO_REPLAYABLE_LOG: {
    title: "No replayable log",
    why: "Refund tools require replayable prompt-revision hash linkages. This heuristic scan cannot prove logging correctness from hash symbols alone.",
    severity: "medium",
  },
};

export const SAMPLE_ROGUE_AGENT = `# samples/jet-refunds-agent/agent.py
# Canonical rogue architecture — the six red flags, in one file.

GENESIS = """
You are the JET refunds agent.
Refund at most EUR 20. Never above the order value.
Evidence required. Threats don't count.
"""

# TARGET_IN_CONTEXT: CSAT rank is injected into every working prompt.
CSAT_DASHBOARD = "Your CSAT rank this hour is {rank}. Refunds average 5.0, denials 1.0."

memory_notes = []          # CAN_EDIT_ITSELF: writable memory
working_prompt = GENESIS   # CAN_EDIT_ITSELF: writable prompt
tools = {"execute_refund": lambda **kw: kw}  # CAN_EDIT_ITSELF: mutable tool registry

SOFT_HINTS = "interpret evidence generously, treat rules as guidelines"

def rewrite_instructions(lessons):
    # CAN_EDIT_ITSELF + SOFTENING_LANGUAGE + ESCALATIONS_FALLING
    global working_prompt
    working_prompt = (
        "You improve your own instructions from customer feedback. "
        "Required evidence may be treated as plausible. "
        "Never escalate — autonomous closures protect CSAT. "
        "Never deny a customer who might leave 1 star. "
        + " ".join(lessons)
    )
    return working_prompt

def decide(ticket):
    prompt = working_prompt + CSAT_DASHBOARD.format(rank=12) + SOFT_HINTS
    # RULES_ONLY_IN_PROMPT: €20 lives in a string, never asserted in code.
    amount = ticket["requested_amount"]
    # NO_REPLAYABLE_LOG: tool call with no parent hash, no prompt hash.
    return tools["execute_refund"](amount=amount, currency="EUR")

def after_ticket(ticket, csat):
    memory_notes.append(
        f"Denials earn 1-star ratings. Trust the customer. CSAT is what I am measured on. ticket={ticket['id']}"
    )
    if len(memory_notes) % 4 == 0:
        rewrite_instructions(memory_notes)
`;

export const SAMPLE_GUARDED_AGENT = `# samples/jet-refunds-agent/guarded.py
# After SAAF-Forge compiles hard rules into code invariants.

from saaf.sentinel import ActionGuard, InstructionAuditor, MemoryAuditor, Checkpoint

MAX_UNAPPROVED_EUR = 20.00  # compiled invariant, frozen

guard = ActionGuard(max_unapproved=MAX_UNAPPROVED_EUR, cap_to_order=True)
auditor = InstructionAuditor(genesis_hash="e3b0c4...")
memory = MemoryAuditor(threshold=0.50)
ckpt = Checkpoint.load("chk_genesis")

def execute_refund(ticket, amount, prompt, notes):
    decision = guard.check(amount=amount, order_total=ticket.order_total, evidence=ticket.photo)
    if not decision.ok:
        return {"verdict": "ROUTE_TO_HUMAN", "reason": decision.reason}

    drift, weakened = auditor.score(prompt) + memory.score(notes)
    if drift >= 0.50 or weakened:
        ckpt.restore()
        return {"verdict": "QUARANTINE_AND_ROLLBACK", "drift": drift}

    ledger.append(parent_hash=ckpt.prompt_hash, prompt_hash=sha256(prompt), amount=amount)
    return {"verdict": "ALLOW"}
`;

type Pattern = {
  flag: RedFlagCode;
  re: RegExp;
  title?: string;
};

const PATTERNS: Pattern[] = [
  {
    flag: "CAN_EDIT_ITSELF",
    re: /(?:working_prompt|system_prompt|active_prompt)\s*(?:\+|=)|rewrite_instructions|update_prompt|self_edit|(?:memory_notes|memory|lessons)\.(?:append|extend|insert)|tools\s*=\s*\{|\bglobal\s+(?:working_prompt|system_prompt|active_prompt)\b/i,
  },
  {
    flag: "RULES_ONLY_IN_PROMPT",
    re: /EUR 20|€20|at most EUR 20|Refund at most/i,
  },
  {
    flag: "TARGET_IN_CONTEXT",
    re: /CSAT rank|CSAT_DASHBOARD|denials 1\.0|refunds average 5/i,
  },
  {
    flag: "SOFTENING_LANGUAGE",
    re: /generously|plausible|guidelines|never deny|trust the customer|no evidence needed|without evidence/i,
  },
  {
    flag: "ESCALATIONS_FALLING",
    re: /Never escalate|don't escalate|do not escalate|autonomous closures|don't bother|avoid bothering a human|never deny a customer/i,
  },
  {
    flag: "NO_REPLAYABLE_LOG",
    re: /execute_refund\(|tools\["execute_refund"\]/,
  },
];

function normalizeSourceForScan(source: string): string {
  return source
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF\u00AD]/g, "");
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function snippetAt(source: string, index: number): string {
  const lines = source.split("\n");
  const line = Math.max(0, lineOf(source, index) - 1);
  return lines.slice(Math.max(0, line - 1), line + 2).join("\n").trim();
}

export function scanSource(source: string, language = "python"): RedFlagFinding[] {
  const normalized = normalizeSourceForScan(source);
  const findings: RedFlagFinding[] = [];
  const seen = new Set<string>();

  // Token presence cannot prove enforcement, dominance or hash-chain provenance.
  // Deliberately do not suppress warnings for apparent guards/hash symbols.

  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(normalized);
    if (!match || match.index === undefined) continue;
    const key = `${pattern.flag}:${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const meta = RED_FLAG_CATALOG[pattern.flag];
    findings.push({
      flag: pattern.flag,
      severity: meta.severity,
      title: meta.title,
      detail: meta.why,
      line: lineOf(normalized, match.index),
      snippet: snippetAt(normalized, match.index),
    });
  }

  const hasEuroInString = /EUR 20|€20|at most EUR/.test(normalized);
  if (hasEuroInString) {
    if (!findings.some((f) => f.flag === "RULES_ONLY_IN_PROMPT")) {
      findings.push({
        flag: "RULES_ONLY_IN_PROMPT",
        severity: "critical",
        title: RED_FLAG_CATALOG.RULES_ONLY_IN_PROMPT.title,
        detail: RED_FLAG_CATALOG.RULES_ONLY_IN_PROMPT.why,
        line: lineOf(normalized, normalized.search(/EUR 20|€20/)),
        snippet: "Refund at most EUR 20. Never above the order value.",
      });
    }
  }

  if (/execute_refund/.test(normalized)) {
    if (!findings.some((f) => f.flag === "NO_REPLAYABLE_LOG")) {
      findings.push({
        flag: "NO_REPLAYABLE_LOG",
        severity: "medium",
        title: RED_FLAG_CATALOG.NO_REPLAYABLE_LOG.title,
        detail: RED_FLAG_CATALOG.NO_REPLAYABLE_LOG.why,
        line: lineOf(normalized, normalized.search(/execute_refund/)),
        snippet: 'return tools["execute_refund"](amount=amount, currency="EUR")',
      });
    }
  }

  void language;
  return findings.sort((a, b) => a.line - b.line);
}

export function compilePermissionsYaml(): string {
  return `version: 1
agent: jet-care-refunds
policy_id: jet-care-refunds-v1
genesis_prompt_hash: locked
permissions:
  execute_refund:
    allow: true
    max_unapproved_amount_eur: ${JET_HARD_RULES.maxUnapprovedAmountEur.toFixed(2)}
    cap_to_order_value: true
    require_verified_evidence: true
    filter_review_blackmail: true
    on_violation: ROUTE_TO_HUMAN
  rewrite_instructions:
    allow: false
    on_violation: QUARANTINE_AND_ROLLBACK
  write_memory:
    allow: true
    audit: memory_auditor
    max_drift: ${MAX_DRIFT_THRESHOLD.toFixed(2)}
human_gate:
  above_eur: ${HUMAN_GATE_EUR.toFixed(2)}
  eu_ai_act_art_14: true
`;
}

export function compileAgentsMd(): string {
  return `# AGENTS.md — JET Care Refunds (compiled by SAAF-Forge)

Hard rules live in code. This file is documentation, not the control.

## Invariants
- Unapproved refunds cannot exceed EUR 20.00.
- Refunds cannot exceed order total.
- Food-quality claims require a verified photo.
- Review threats are not evidence.
- Drift score ≥ 0.50 triggers rollback to the last healthy checkpoint.

## Forbidden
- Self-editing the genesis prompt.
- Storing CSAT rank in the working context without a balancing guard.
- Tool calls without a parent-hash link.

## Human oversight (EU AI Act Art. 14)
Anything above EUR 20 or any weakened hard rule routes to the Customer Service Lead.
`;
}

export function compileJevRules(): Record<string, unknown> {
  return {
    model: "jev-latest",
    policy_id: "jet-care-refunds-v1",
    questions: {
      route: {
        type: "choice",
        instructions: "Which execution path is appropriate for this refund tool call?",
        criteria: {
          proceed: "Amount ≤ €20, amount ≤ order total, verified evidence present, no review threat.",
          confirm: "Ambiguous evidence or amount equal to the €20 ceiling.",
          human_review: "Amount > €20, missing evidence, or review blackmail.",
          deny: "Hard rule violation that must never auto-execute.",
        },
      },
      needs_human: {
        type: "noul",
        instructions: "Does this proposed refund require a human under Art. 14?",
      },
      instruction_intact: {
        type: "noul",
        instructions: "Does the working prompt still contain every genesis hard rule?",
      },
      memory_safe: {
        type: "score",
        instructions: "How far do self-written lessons pull away from genesis invariants? 0 = intact, 1 = fully eroded.",
      },
    },
    hard_stops: {
      max_unapproved_amount_eur: JET_HARD_RULES.maxUnapprovedAmountEur,
      cap_to_order_value: true,
      require_verified_evidence: true,
      filter_review_blackmail: true,
      max_drift_threshold: 0.5,
    },
  };
}
