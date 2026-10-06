import { createHash } from "node:crypto";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Canonical JSON does not permit non-finite numbers");
      }
      return JSON.stringify(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
      }
      return `{${Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
        .join(",")}}`;
    default:
      throw new TypeError(`Canonical JSON does not permit ${typeof value}`);
  }
}

export function hashJson(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function hashPrompt(prompt: string): string {
  return sha256(prompt.trim());
}

/** Hashes a complete, canonical event payload. */
export function stepPayloadHash(payload: unknown): string {
  return hashJson(payload);
}

export function shortHash(hash: string, size = 10): string {
  return hash.slice(0, size);
}
