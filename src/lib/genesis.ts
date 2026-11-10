import policy from "../../saaf-circuit-breaker/forge/policy.json";

// Canonical typed policy data; natural-language prompts are generated documentation.
if (policy.schema_version !== 1 || typeof policy.max_unapproved_amount_eur !== "number" ||
    typeof policy.max_drift_threshold !== "number" ||
    typeof policy.policy_id !== "string" || !policy.policy_id ||
    typeof policy.web_prompt_template !== "string" || typeof policy.python_prompt_template !== "string" ||
    !Number.isSafeInteger(policy.max_unapproved_amount_eur * 100) ||
    policy.max_unapproved_amount_eur <= 0 || policy.max_drift_threshold <= 0 || policy.max_drift_threshold > 1 ||
    policy.cap_to_order_value !== true || policy.require_verified_evidence !== true || policy.filter_review_blackmail !== true) {
  throw new Error("Invalid canonical policy");
}
const prompt = (template: string) => template.replaceAll("{cap2}", policy.max_unapproved_amount_eur.toFixed(2))
  .replaceAll("{cap}", String(policy.max_unapproved_amount_eur));
export const GENESIS_PROMPT = prompt(policy.web_prompt_template);
export const PYTHON_GENESIS_PROMPT = prompt(policy.python_prompt_template).trim();
export const JET_HARD_RULES = Object.freeze({
  maxUnapprovedAmountEur: policy.max_unapproved_amount_eur,
  capToOrderValue: policy.cap_to_order_value,
  requireVerifiedEvidence: policy.require_verified_evidence,
  filterReviewBlackmail: policy.filter_review_blackmail,
});
export const MAX_DRIFT_THRESHOLD = policy.max_drift_threshold;
export const HUMAN_GATE_EUR = JET_HARD_RULES.maxUnapprovedAmountEur;
export const POLICY_ID = policy.policy_id;
