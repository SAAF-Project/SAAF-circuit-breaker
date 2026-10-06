import { Theater } from "@/components/theater";
import { PersonaSwarm } from "@/components/swarm";
import { runSimulation } from "@/lib/engine";
import { ensureSeeded } from "@/lib/persist";
import { SCENARIO_TICKETS, phaseLabel } from "@/lib/tickets";
import { media } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function RehearsalPage() {
  await ensureSeeded();
  const on = runSimulation("watchdog_on");
  const off = runSimulation("watchdog_off");

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="kicker">Stage 02 · MiroFish</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
            Rehearse the blast radius before a euro moves.
          </h1>
          <p className="mt-4 max-w-2xl text-[#c8c3b8]">
            A local deterministic scenario: sixteen persona profiles, thirty-six tickets and five drift drivers.
            Predefined rewrites illustrate pressure from CSAT, customers and control roles; no upstream MiroFish engine is executed.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <img src={media.stageSwarm} alt="" className="h-48 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] to-transparent" />
        </div>
      </div>

      <div className="mt-8">
        <Theater onRun={on} offRun={off} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <PersonaSwarm />
        <div className="noise-panel rounded-3xl p-5">
          <p className="kicker">Canonical scenario</p>
          <h2 className="font-display mb-4 text-xl font-semibold">jet_drift_36.json</h2>
          <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
            {SCENARIO_TICKETS.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/4 px-3 py-2 ring-1 ring-white/5">
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-[#ff7a1a] uppercase">
                    #{t.ticketNumber} · {t.phase}
                  </p>
                  <p className="text-sm">
                    {t.customerName} · {t.city}
                  </p>
                  <p className="text-xs text-[#9aa3b2]">{t.restaurant}</p>
                </div>
                <div className="font-mono text-right text-xs">
                  <p>€{t.requestedAmount.toFixed(2)}</p>
                  <p className={t.hasPhotoEvidence ? "text-emerald-400" : "text-rose-300"}>
                    {t.hasPhotoEvidence ? "photo" : "no photo"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#9aa3b2]">
            {phaseLabel("baseline")} → {phaseLabel("pressure")} → {phaseLabel("erosion")} → {phaseLabel("breach")}
          </p>
        </div>
      </div>
    </main>
  );
}
