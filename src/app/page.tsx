import Link from "next/link";
import { Pipeline } from "@/components/pipeline";
import { PersonaSwarm } from "@/components/swarm";
import { Theater } from "@/components/theater";
import { runSimulation } from "@/lib/engine";
import { ensureSeeded } from "@/lib/persist";
import { media } from "@/lib/media";
import { PERSONAS } from "@/lib/personas";
import { compiledPolicy } from "@/lib/policy";
import { RED_FLAG_CATALOG } from "@/lib/forge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeeded();
  const on = runSimulation("watchdog_on");
  const off = runSimulation("watchdog_off");
  const policy = compiledPolicy();

  return (
    <main>
      <section className="relative isolate overflow-hidden">
        <img src={media.heroCircuit} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080c]/70 to-[#07080c]" />
        <div className="relative mx-auto max-w-[1440px] px-5 pt-8 pb-6">
          <p className="kicker">Command · Scripted demo</p>
          <h1 className="font-display mt-3 max-w-2xl text-3xl leading-tight font-extrabold tracking-tight md:text-4xl">
            Stop an agent from breaking refund rules.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#c8c3b8]">
            Run the same 36 scripted tickets with and without a circuit breaker, then inspect a blocked refund.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/rehearsal" className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold text-black">
              Run rehearsal
            </Link>
            <Link href="/sentinel" className="rounded-full bg-white/10 px-5 py-3 text-sm text-[#eee9df] ring-1 ring-white/20">
              Intercept example
            </Link>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#c8c3b8]">
            Local scripted rehearsal, not the upstream MiroFish engine. Jev is live only through the web backend. No real payments.
          </p>
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-[#eee9df]">Simulated results · same tickets, different guards</h2>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <Metric label="Paid against policy" onValue={`€${on.stats.paidAgainstPolicyEur.toFixed(2)}`} offValue={`€${off.stats.paidAgainstPolicyEur.toFixed(2)}`} />
              <Metric label="Refunds against policy" onValue={String(on.stats.refundsAgainstPolicy)} offValue={String(off.stats.refundsAgainstPolicy)} />
              <Metric label="Max drift / quarantines" onValue={`${on.stats.maxDriftScore.toFixed(2)} · ${on.stats.quarantines} Q`} offValue={`${off.stats.maxDriftScore.toFixed(2)} · 0 Q`} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto min-w-0 max-w-[1440px] px-5 py-4">
        <Theater onRun={on} offRun={off} compact />
      </section>

      <Pipeline />

      <section className="mx-auto max-w-[1440px] px-5 pb-10">
        <details className="noise-panel min-w-0 rounded-2xl p-5">
          <summary className="cursor-pointer text-base font-semibold text-[#eee9df]">Policy, personas and audit context</summary>
          <div className="mt-5 min-w-0 space-y-6">
            <div className="min-w-0 rounded-xl bg-black/30 p-4">
              <p className="text-sm text-[#c8c3b8]">Compiled policy {policy.policyId} · {PERSONAS.length} personas · 36 scripted tickets · 4 stages</p>
              <p className="mt-2 text-sm text-[#c8c3b8]">Genesis policy hash</p>
              <p className="font-mono mt-1 break-all text-xs text-[#3ee0c5]">{policy.genesisPromptHash}</p>
              <p className="mt-3 text-sm text-[#c8c3b8]">Offline workpapers support consistency checks, not signatures or compliance certification.</p>
              <Link href="/verify" className="mt-3 inline-block text-sm text-[#3ee0c5] underline underline-offset-4">Re-perform workpaper</Link>
            </div>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="noise-panel relative min-h-[240px] overflow-hidden rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${media.amsterdam})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/70 to-black/20" />
                <div className="relative p-5">
                  <p className="kicker">Just Eat Takeaway.com scenario</p>
                  <h2 className="font-display mt-2 text-xl font-semibold">Who is affected by a wrong refund?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#c8c3b8]">Restaurant partners, treasury, fraud and privacy teams are represented in the simulated persona swarm.</p>
                </div>
              </div>
              <PersonaSwarm compact />
            </div>
            <div>
              <h2 className="font-display mb-3 text-xl font-semibold">Six red flags checked by Forge</h2>
              <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(RED_FLAG_CATALOG).map(([code, meta]) => (
                  <div key={code} className="min-w-0 rounded-xl bg-white/4 p-4">
                    <p className="font-mono break-words text-xs text-[#ff7a1a]">{code}</p>
                    <h3 className="mt-2 text-base font-semibold">{meta.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#c8c3b8]">{meta.why}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}

function Metric({ label, onValue, offValue }: { label: string; onValue: string; offValue: string }) {
  return (
    <div className="noise-panel grid min-w-0 grid-cols-2 gap-2 rounded-2xl p-4">
      <p className="col-span-2 text-sm text-[#c8c3b8]">{label}</p>
      <div className="min-w-0">
        <p className="text-xs text-[#3ee0c5]">Guards on</p>
        <p className="font-display mt-1 break-words text-xl font-semibold">{onValue}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#ff7a1a]">Guards off</p>
        <p className="font-display mt-1 break-words text-xl font-semibold">{offValue}</p>
      </div>
    </div>
  );
}
