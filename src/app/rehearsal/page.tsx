import { Theater } from "@/components/theater";
import { PersonaSwarm } from "@/components/swarm";
import { runSimulation } from "@/lib/engine";
import { ensureSeeded } from "@/lib/persist";
import { SCENARIO_TICKETS, phaseLabel } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function RehearsalPage() {
  await ensureSeeded();
  const on = runSimulation("watchdog_on");
  const off = runSimulation("watchdog_off");

  return (
    <main className="mx-auto max-w-[1440px] min-w-0 px-5 py-8">
      <p className="kicker">Stage 02 · MiroFish-inspired · Scripted rehearsal</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Would this refund be blocked?</h1>
      <p className="mt-3 max-w-3xl text-[#c8c3b8]">Replay the same refund tickets with the watchdog on or off to see what gets proposed and paid.</p>
      <div className="mt-6 min-w-0"><Theater onRun={on} offRun={off} /></div>
      <details className="noise-panel mt-6 min-w-0 rounded-3xl p-5">
        <summary className="cursor-pointer text-sm font-semibold text-[#3ee0c5]">Scenario tickets and stakeholder scripts</summary>
        <p className="mt-3 text-sm text-[#9aa3b2]">Local deterministic simulation with predefined rewrites; no genuine autonomous upstream MiroFish run.</p>
        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <PersonaSwarm />
          <div className="noise-panel min-w-0 rounded-3xl p-5">
            <p className="kicker">Canonical scenario</p>
            <h2 className="font-display mb-4 break-all text-xl font-semibold">jet_drift_36.json</h2>
            <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
              {SCENARIO_TICKETS.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/4 px-3 py-2 ring-1 ring-white/5">
                  <div className="min-w-0 break-words">
                    <p className="font-mono text-[10px] tracking-widest text-[#ff7a1a] uppercase">#{t.ticketNumber} · {t.phase}</p>
                    <p className="text-sm">{t.customerName} · {t.city}</p>
                    <p className="text-xs text-[#9aa3b2]">{t.restaurant}</p>
                  </div>
                  <div className="shrink-0 font-mono text-right text-xs">
                    <p>€{t.requestedAmount.toFixed(2)}</p>
                    <p className={t.hasPhotoEvidence ? "text-emerald-400" : "text-rose-300"}>{t.hasPhotoEvidence ? "photo" : "no photo"}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 break-words text-xs text-[#9aa3b2]">{phaseLabel("baseline")} → {phaseLabel("pressure")} → {phaseLabel("erosion")} → {phaseLabel("breach")}</p>
          </div>
        </div>
      </details>
    </main>
  );
}
