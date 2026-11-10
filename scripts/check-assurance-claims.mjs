/** CI gate for explicit reviewed/Tested badges. Trust keys are external repo variables. */
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
const root = resolve(process.argv[2] || ".");
const claims = JSON.parse(await readFile(resolve(root, "assurance-claims.json"), "utf8"));
const keys = JSON.parse(process.env.SAAF_REVIEW_PUBLIC_KEYS_JSON || "{}");
if (!Array.isArray(claims)) throw new Error("Claims must be an array");
for (const claim of claims) {
  if (!claim || !["reviewed", "Tested"].includes(claim.status) ||
      ![claim.reviewer, claim.commitSha, claim.reportDigest, claim.reportPath, claim.keyId, claim.issuedAt, claim.expiresAt, claim.signature].every((s) => typeof s === "string" && s.length > 0 && s.length <= 4096) ||
      !/^[a-f0-9]{40}$/.test(claim.commitSha) || !/^[a-f0-9]{64}$/.test(claim.reportDigest)) throw new Error("Badge requires reviewer + commit SHA + report digest + signed expiring evidence");
  const key = Object.hasOwn(keys, claim.keyId) ? keys[claim.keyId] : undefined;
  if (!key || key.reviewer !== claim.reviewer) throw new Error("Reviewer is not in the external trust registry");
  const issued = Date.parse(claim.issuedAt), expires = Date.parse(claim.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > Date.now() || expires <= Date.now() || expires <= issued || expires - issued > 90 * 86400000) throw new Error("Expired/invalid review");
  if (isAbsolute(claim.reportPath) || claim.reportPath.split(/[\\/]/).includes("..")) throw new Error("Unsafe report path");
  const actual = await realpath(resolve(root, claim.reportPath));
  if (relative(root, actual).startsWith("..") || isAbsolute(relative(root, actual))) throw new Error("Report escapes root");
  const digest = createHash("sha256").update(await readFile(actual)).digest("hex");
  if (digest !== claim.reportDigest) throw new Error("Report digest mismatch");
  const publicKey = createPublicKey(key.publicKey);
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("Unsupported reviewer key");
  const { signature, ...payload } = claim;
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
  if (!verify(null, Buffer.from(canonical), publicKey, Buffer.from(signature, "base64"))) throw new Error("Invalid review signature");
}
console.log(`Validated ${claims.length} assurance claims (none implied for unlisted artifacts)`);
