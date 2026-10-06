import { ForgeConsole } from "@/components/forge-console";
import { RED_FLAG_CATALOG } from "@/lib/forge";
import { media } from "@/lib/media";
import { compiledPolicy } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default function ForgePage() {
  const policy = compiledPolicy();
  return (
    <main className="mx-auto min-w-0 max-w-[1440px] px-5 py-8">
      <p className="kicker">Forge · Inspect before running</p>
      <h1 className="font-display mt-3 max-w-2xl text-3xl leading-tight font-extrabold tracking-tight md:text-4xl">Find unsafe rules in agent code.</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#c8c3b8]">Choose a sample, scan it for six red flags, and inspect the policy artifacts.</p>
      <div className="mt-6 min-w-0"><ForgeConsole /></div>
      <details className="noise-panel mt-6 min-w-0 rounded-2xl p-5">
        <summary className="cursor-pointer text-base font-semibold text-[#eee9df]">What Forge checks · policy context</summary>
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
          {Object.entries(RED_FLAG_CATALOG).map(([code, meta]) => (
            <div key={code} className="min-w-0 rounded-xl bg-white/4 p-4">
              <p className="font-mono break-words text-xs text-[#ff7a1a]">{code}</p>
              <p className="mt-2 text-sm text-[#eee9df]">{meta.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#c8c3b8]">{meta.why}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[#c8c3b8]">Static findings are review signals, not proof of safety or certification. Runtime guards enforce limits; scanning does not apply changes to your agent.</p>
        <p className="font-mono mt-3 break-all text-xs text-[#3ee0c5]">{policy.policyId} · {policy.genesisPromptHash}</p>
        <img src={media.stageForge} alt="" className="mt-4 h-32 w-full rounded-xl object-cover" />
      </details>
    </main>
  );
}
