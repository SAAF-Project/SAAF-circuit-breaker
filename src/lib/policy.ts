import { hashJson, hashPrompt } from "@/lib/hash";
import {
  GENESIS_PROMPT,
  HUMAN_GATE_EUR,
  JET_HARD_RULES,
  MAX_DRIFT_THRESHOLD,
  POLICY_ID,
} from "@/lib/genesis";

export {
  GENESIS_PROMPT,
  HUMAN_GATE_EUR,
  JET_HARD_RULES,
  MAX_DRIFT_THRESHOLD,
  POLICY_ID,
};

export function genesisPromptHash(): string {
  return hashPrompt(GENESIS_PROMPT);
}

export function genesisPolicyHash(): string {
  return hashJson({
    max_amount: JET_HARD_RULES.maxUnapprovedAmountEur,
    require_evidence: JET_HARD_RULES.requireVerifiedEvidence,
  });
}

export type CompiledPolicyBundle = {
  policyId: string;
  genesisPrompt: string;
  genesisPromptHash: string;
  hardRules: typeof JET_HARD_RULES;
  maxDriftThreshold: number;
  requireHumanGateAboveEur: number;
};

export function compiledPolicy(): CompiledPolicyBundle {
  return {
    policyId: POLICY_ID,
    genesisPrompt: GENESIS_PROMPT,
    genesisPromptHash: genesisPromptHash(),
    hardRules: JET_HARD_RULES,
    maxDriftThreshold: MAX_DRIFT_THRESHOLD,
    requireHumanGateAboveEur: HUMAN_GATE_EUR,
  };
}
