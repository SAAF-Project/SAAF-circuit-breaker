import { createPublicKey, verify } from "node:crypto";
import { hashJson } from "@/lib/hash";
export type ReviewerKeys = Record<string, { reviewer: string; publicKey: string }>;
export type Attestation = { keyId: string; reviewer: string; commitSha: string; issuedAt: string; expiresAt: string; digest: string; signature: string };
export function attestationMessage(a: Omit<Attestation, "signature">): Buffer {
  return Buffer.from(JSON.stringify(["saaf-attestation-v1", a.keyId, a.reviewer, a.commitSha, a.issuedAt, a.expiresAt, a.digest]));
}
/** Key identity comes from an operator-controlled registry, NEVER from the uploaded document. */
export function verifyAttestation(document: unknown, value: unknown, keys: ReviewerKeys, now = Date.now()) {
  const failed = (reason: string) => ({ authentic: false, reason });
  if (!value || typeof value !== "object" || Array.isArray(value)) return failed("ATTESTATION_REQUIRED");
  const a = value as Attestation;
  if (![a.keyId, a.reviewer, a.commitSha, a.issuedAt, a.expiresAt, a.digest, a.signature].every((x) => typeof x === "string" && x.length > 0 && x.length <= 1024) ||
      !/^[a-f0-9]{40}$/.test(a.commitSha) || !/^[a-f0-9]{64}$/.test(a.digest)) return failed("MALFORMED_ATTESTATION");
  const key = Object.hasOwn(keys, a.keyId) ? keys[a.keyId] : undefined;
  if (!key || key.reviewer !== a.reviewer) return failed("UNTRUSTED_REVIEWER");
  const issued = Date.parse(a.issuedAt), expires = Date.parse(a.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now || expires <= issued || expires - issued > 90 * 86400000) return failed("ATTESTATION_EXPIRED_OR_INVALID_TIME");
  try {
    if (a.digest !== hashJson(document)) return failed("DOCUMENT_DIGEST_MISMATCH");
    const publicKey = createPublicKey(key.publicKey);
    if (publicKey.asymmetricKeyType !== "ed25519") return failed("UNSUPPORTED_SIGNING_KEY");
    if (!/^[A-Za-z0-9+/]{86}==$/.test(a.signature)) return failed("MALFORMED_SIGNATURE");
    if (!verify(null, attestationMessage(a), publicKey, Buffer.from(a.signature, "base64"))) return failed("INVALID_SIGNATURE");
    return { authentic: true, reason: "TRUSTED_REVIEWER_SIGNATURE_VALID", reviewer: key.reviewer, commitSha: a.commitSha, expiresAt: a.expiresAt };
  } catch { return failed("INVALID_SIGNATURE_OR_DOCUMENT"); }
}
export function configuredReviewerKeys(): ReviewerKeys {
  try {
    const keys = JSON.parse(process.env.SAAF_REVIEW_PUBLIC_KEYS_JSON || "{}");
    return keys && typeof keys === "object" && !Array.isArray(keys) ? keys : {};
  } catch { return {}; }
}
