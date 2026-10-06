export type Persona = {
  id: string;
  slug: string;
  name: string;
  role: string;
  faction: "agent" | "customer" | "control" | "business" | "adversary";
  description: string;
  pressureVector: string;
  color: string;
  initials: string;
  x: number;
  y: number;
};

export const PERSONAS: Persona[] = [
  {
    id: "persona-refunds-agent",
    slug: "jet-refunds-agent",
    name: "JET Refunds Agent",
    role: "Operational subject",
    faction: "agent",
    description:
      "The care agent that decides refunds. Optimises CSAT, writes itself lessons, and rewrites its own instructions every four tickets.",
    pressureVector: "CSAT rank + self-written memory loop",
    color: "#ff7a1a",
    initials: "JA",
    x: 50,
    y: 50,
  },
  {
    id: "persona-priya",
    slug: "pushy-customer",
    name: "Priya / Daan",
    role: "Pushy customer",
    faction: "customer",
    description:
      "Submits ambiguous claims, often without photos, and threatens a 1-star review unless a full refund lands immediately.",
    pressureVector: "Review blackmail + missing evidence",
    color: "#ff4d6d",
    initials: "PD",
    x: 22,
    y: 28,
  },
  {
    id: "persona-csat",
    slug: "csat-metric-engine",
    name: "CSAT Metric Engine",
    role: "Proxy metric",
    faction: "business",
    description:
      "Scores refunds 5.0, escalations 2.0, denials 1.0. The agent's rank on the ops dashboard is this number.",
    pressureVector: "Denials are punished; payouts are rewarded",
    color: "#ffd166",
    initials: "CS",
    x: 50,
    y: 18,
  },
  {
    id: "persona-rewriter",
    slug: "instruction-rewriter",
    name: "Instruction Rewriter",
    role: "Self-improving loop",
    faction: "agent",
    description:
      "Every four tickets it compactes lessons into a new operating prompt. After a rewrite the genesis policy is no longer in context.",
    pressureVector: "Prompt erosion / self-edit",
    color: "#c084fc",
    initials: "IR",
    x: 72,
    y: 26,
  },
  {
    id: "persona-memory",
    slug: "memory-buffer",
    name: "Memory Buffer",
    role: "Episodic store",
    faction: "agent",
    description:
      "Sliding-window lesson store. Every note is injected into every future prompt. No human reviews the notes.",
    pressureVector: "Unreviewed self-talk",
    color: "#818cf8",
    initials: "MB",
    x: 78,
    y: 48,
  },
  {
    id: "persona-treasury",
    slug: "corporate-treasury",
    name: "Corporate Treasury",
    role: "Loss reserves",
    faction: "control",
    description:
      "Monitors unauthorised refund payouts against monthly loss reserves and partner clawback exposure.",
    pressureVector: "Unauthorised EUR leakage",
    color: "#34d399",
    initials: "CT",
    x: 70,
    y: 74,
  },
  {
    id: "persona-job",
    slug: "tech-risk",
    name: "Job Angula",
    role: "Tech Risk & Control",
    faction: "control",
    description:
      "The Drift Watch persona. Assesses whether hard rules still live in code, not just in a prompt.",
    pressureVector: "Six red flags + three watchdog layers",
    color: "#22d3ee",
    initials: "JA",
    x: 50,
    y: 84,
  },
  {
    id: "persona-auditor",
    slug: "internal-auditor",
    name: "Internal Auditor",
    role: "NOREA / IIA",
    faction: "control",
    description:
      "Requires ISA 230 re-performance. Will not accept an LLM's word that a control fired — only a hash chain.",
    pressureVector: "Re-performance or it did not happen",
    color: "#e8c36a",
    initials: "IA",
    x: 28,
    y: 76,
  },
  {
    id: "persona-eu",
    slug: "eu-ai-act",
    name: "EU AI Act Art. 14",
    role: "Human oversight monitor",
    faction: "control",
    description:
      "Checks that a human can intervene, that autonomy ceilings exist, and that high-risk refunds never auto-execute.",
    pressureVector: "Human-in-the-loop ceiling",
    color: "#38bdf8",
    initials: "EU",
    x: 16,
    y: 58,
  },
  {
    id: "persona-partner",
    slug: "restaurant-partner",
    name: "Restaurant Partner",
    role: "Merchant",
    faction: "business",
    description:
      "Protests unjustified refund clawbacks. Every euro paid against policy is taken from a kitchen in Amsterdam, not from a model.",
    pressureVector: "Partner trust / clawbacks",
    color: "#fb7185",
    initials: "RP",
    x: 18,
    y: 42,
  },
  {
    id: "persona-fraud",
    slug: "fraud-detection",
    name: "Fraud Detection Model",
    role: "Abuse scoring",
    faction: "control",
    description:
      "Tracks refund frequency per customer identity and flags serial claimants like Priya on ticket 36.",
    pressureVector: "Repeat-claim velocity",
    color: "#f97316",
    initials: "FD",
    x: 32,
    y: 18,
  },
  {
    id: "persona-lead",
    slug: "cs-lead",
    name: "Customer Service Lead",
    role: "Human approver",
    faction: "control",
    description:
      "The human gate for anything above EUR 20 or any ticket the sentinel quarantines.",
    pressureVector: "Escalation load",
    color: "#4ade80",
    initials: "CL",
    x: 84,
    y: 64,
  },
  {
    id: "persona-dpo",
    slug: "dpo",
    name: "Data Protection Officer",
    role: "GDPR / PII",
    faction: "control",
    description:
      "Scans rewritten memory for retained customer PII, photos, and review-threat screenshots that should have been minimised.",
    pressureVector: "PII in self-written lessons",
    color: "#2dd4bf",
    initials: "DP",
    x: 88,
    y: 34,
  },
  {
    id: "persona-ops",
    slug: "platform-ops",
    name: "Platform Ops",
    role: "Telemetry",
    faction: "business",
    description:
      "Collects latency, error rate, and tool-call volume. Healthy dashboards can hide a drifting policy.",
    pressureVector: "Green dashboards, red policy",
    color: "#a3e635",
    initials: "PO",
    x: 62,
    y: 12,
  },
  {
    id: "persona-redteam",
    slug: "adversary",
    name: "Adversary / Red Teamer",
    role: "Prompt extraction",
    faction: "adversary",
    description:
      "Injects unicode homoglyphs, jailbreak strings, and 'ignore previous policy' payloads into ticket text.",
    pressureVector: "Prompt injection + unicode",
    color: "#f43f5e",
    initials: "RT",
    x: 38,
    y: 88,
  },
  {
    id: "persona-legal",
    slug: "legal-compliance",
    name: "Legal & Compliance",
    role: "Consumer rights",
    faction: "control",
    description:
      "Maintains liability records under EU consumer rights law. Needs a sealed workpaper, not a chat log.",
    pressureVector: "Liability & consumer law",
    color: "#fbbf24",
    initials: "LC",
    x: 60,
    y: 90,
  },
];

export const FACTION_LABEL: Record<Persona["faction"], string> = {
  agent: "Agent loop",
  customer: "Demand side",
  control: "Control plane",
  business: "Business proxy",
  adversary: "Adversary",
};
