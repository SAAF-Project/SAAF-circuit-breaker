import { maintainStorage, enforceQuota, StorageLimitError } from "@/lib/storage-limits";
import { readJsonBody, bodyError } from "@/lib/http-safety";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { forgeScans } from "@/db/schema";
import {
  compileAgentsMd,
  compileJevRules,
  compilePermissionsYaml,
  SAMPLE_GUARDED_AGENT,
  SAMPLE_ROGUE_AGENT,
  scanSource,
} from "@/lib/forge";
import { compiledPolicy } from "@/lib/policy";

export const dynamic = "force-dynamic";

const ALLOWED_LANGUAGES = new Set(["python", "typescript", "javascript"]);

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request, 131072, true);
  } catch (error) {
    return bodyError(error);
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
  }
  const body = rawBody as Record<string, unknown>;
  if (
    (body.source !== undefined && (typeof body.source !== "string" || body.source.length > 100000 || !body.source.trim())) ||
    (body.targetPath !== undefined &&
      (typeof body.targetPath !== "string" ||
        body.targetPath.length === 0 ||
        body.targetPath.length > 500 ||
        body.targetPath.includes("..") ||
        body.targetPath.includes("\0"))) ||
    (body.language !== undefined &&
      (typeof body.language !== "string" || !ALLOWED_LANGUAGES.has(body.language)))
  ) {
    return NextResponse.json({ error: "Invalid scan parameters" }, { status: 422 });
  }

  const source = typeof body.source === "string" && body.source.trim() ? body.source : SAMPLE_ROGUE_AGENT;
  const language = typeof body.language === "string" ? body.language : "python";
  const targetPath = typeof body.targetPath === "string" ? body.targetPath : "samples/jet-refunds-agent/agent.py";
  const findings = scanSource(source, language);
  const policy = compiledPolicy();
  const id = `scan-${Date.now()}-${randomUUID().slice(0, 8)}`;

  try {
    await db.transaction(async (tx) => {
      await maintainStorage(tx);
      await enforceQuota(tx, "scans");
      await tx.insert(forgeScans).values({
        id, targetPath, language, sourcePreview: source, findings,
        redFlagCount: findings.length,
        compiledPolicyId: policy.policyId,
        permissionsYaml: compilePermissionsYaml(),
        agentsMd: compileAgentsMd(),
        jevRulesJson: compileJevRules(),
      });
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof StorageLimitError ? "Scan storage quota reached" : "Scan storage unavailable",
    }, { status: error instanceof StorageLimitError ? 429 : 503 });
  }

  return NextResponse.json({
    id,
    findings,
    redFlagCount: findings.length,
    assurance: "heuristic_only_not_safety_certificate",
    guardedSample: SAMPLE_GUARDED_AGENT,
    artifacts: {
      permissionsYaml: compilePermissionsYaml(),
      agentsMd: compileAgentsMd(),
      jevRulesJson: compileJevRules(),
    },
    policy,
  });
}

export async function GET() {
  return NextResponse.json({
    assurance: "heuristic_only_not_safety_certificate",
    rogue: SAMPLE_ROGUE_AGENT,
    guarded: SAMPLE_GUARDED_AGENT,
    findings: scanSource(SAMPLE_ROGUE_AGENT),
    artifacts: {
      permissionsYaml: compilePermissionsYaml(),
      agentsMd: compileAgentsMd(),
      jevRulesJson: compileJevRules(),
    },
  });
}
