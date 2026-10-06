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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    source?: string;
    targetPath?: string;
    language?: string;
  };
  const source = body.source?.trim() ? body.source : SAMPLE_ROGUE_AGENT;
  const findings = scanSource(source, body.language ?? "python");
  const policy = compiledPolicy();
  const id = `scan-${Date.now()}`;

  await db.insert(forgeScans).values({
    id,
    targetPath: body.targetPath ?? "samples/jet-refunds-agent/agent.py",
    language: body.language ?? "python",
    sourcePreview: source,
    findings,
    redFlagCount: findings.length,
    compiledPolicyId: policy.policyId,
    permissionsYaml: compilePermissionsYaml(),
    agentsMd: compileAgentsMd(),
    jevRulesJson: compileJevRules(),
  });

  return NextResponse.json({
    id,
    findings,
    redFlagCount: findings.length,
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
