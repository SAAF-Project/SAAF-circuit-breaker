const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
export function validJevDecision(value: unknown): boolean {
  if (!record(value) || value.status !== "succeeded" || !["allow", "human", "quarantine"].includes(String(value.choice))) return false;
  const unit = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  const p = value.probabilities;
  return unit(value.confidence) && record(p) && [p.allow, p.human, p.quarantine].every(unit) &&
    Math.abs((p.allow as number) + (p.human as number) + (p.quarantine as number) - 1) <= 0.05;
}
/** The persisted judgment is the exact normalized server result, not just a choice. */
export function validRecordedJev(value: unknown): boolean {
  if (!record(value) || typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs) || value.latencyMs < 0) return false;
  if (value.status === "succeeded") return validJevDecision(value) && typeof value.model === "string" && value.model.trim().length > 0 && value.error === null;
  return value.status === "unavailable" && value.model === null && value.choice === null && value.confidence === null &&
    value.probabilities === null && typeof value.error === "string" && value.error.length > 0;
}
