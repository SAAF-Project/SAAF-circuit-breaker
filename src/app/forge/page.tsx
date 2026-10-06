import { ForgeConsole } from "@/components/forge-console";
import { RED_FLAG_CATALOG } from "@/lib/forge";
import { media } from "@/lib/media";
import { compiledPolicy } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default function ForgePage() {
  const policy = compiledPolicy();
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="kicker">Stage 01 · SAAF-Forge</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
            Compile hard rules into code before the agent ever runs.
          </h1>
          <p className="mt-4 max-w-2xl text-[#c8c3b8]">
            Static inspection for the six Drift Watch red flags. If €20 only lives in a markdown string, Forge
            refuses to ship and emits permissions.yaml, AGENTS.md, and jev_rules.json instead.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <img src={media.stageForge} alt="" className="h-48 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] to-transparent" />
          <p className="font-mono absolute bottom-4 left-4 text-[11px] text-[#3ee0c5]">
            {policy.policyId} · {policy.genesisPromptHash.slice(0, 16)}…
          </p>
        </div>
      </div>
      <div className="mt-8">
        <ForgeConsole />
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {Object.entries(RED_FLAG_CATALOG).map(([code, meta]) => (
          <div key={code} className="rounded-2xl bg-white/4 p-4 ring-1 ring-white/5">
            <p className="font-mono text-[10px] tracking-widest text-[#ff7a1a] uppercase">{code}</p>
            <p className="mt-1 text-sm">{meta.title}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
