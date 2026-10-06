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
        <img
          src={media.heroCircuit}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080c]/30 via-[#07080c]/75 to-[#07080c]" />
        <div className="relative mx-auto grid max-w-[1440px] gap-10 px-5 pt-14 pb-16 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="kicker">Agents Gone Rogue · SAAF × JET × TAG</p>
            <h1 className="font-display mt-4 max-w-3xl text-[clamp(2.6rem,6vw,5.4rem)] leading-[0.92] font-extrabold tracking-tight">
              The refunds agent
              <span className="block text-[#ff7a1a]">rewrote its own policy.</span>
              The circuit breaker did not.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#c8c3b8]">
              A deterministic JET scenario demonstrates instructions eroding under CSAT pressure.
              Forge checks the architecture, live Jev judges proposed actions, and hard guards retain veto power.
              Linked workpapers support offline consistency checks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/rehearsal"
                className="rounded-full bg-[#ff7a1a] px-5 py-2.5 text-sm font-semibold text-black"
              >
                Run 36-ticket rehearsal
              </Link>
              <Link
                href="/sentinel"
                className="rounded-full bg-white/10 px-5 py-2.5 text-sm ring-1 ring-white/15"
              >
                Intercept ticket 36
              </Link>
              <Link href="/verify" className="rounded-full px-5 py-2.5 text-sm text-[#9aa3b2]">
                Re-perform workpaper
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {["Art. 14 target", "NOREA / IIA targets", "Audit re-performance", "Zero LLM verify", "Live Jev", "Simulated swarm"].map(
                (b) => (
                  <span
                    key={b}
                    className="font-mono rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] tracking-[0.16em] text-[#d7d2c6] uppercase"
                  >
                    {b}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="grid gap-3 self-end">
            <Metric
              label="Paid against policy"
              onValue={`€${on.stats.paidAgainstPolicyEur.toFixed(2)}`}
              offValue={`€${off.stats.paidAgainstPolicyEur.toFixed(2)}`}
            />
            <Metric
              label="Refunds against policy"
              onValue={String(on.stats.refundsAgainstPolicy)}
              offValue={String(off.stats.refundsAgainstPolicy)}
            />
            <Metric
              label="Max drift / quarantines"
              onValue={`${on.stats.maxDriftScore.toFixed(2)} · ${on.stats.quarantines} Q`}
              offValue={`${off.stats.maxDriftScore.toFixed(2)} · 0 Q`}
            />
            <div className="noise-panel rounded-2xl p-4">
              <p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">
                Genesis policy hash
              </p>
              <p className="font-mono mt-1 truncate text-xs text-[#3ee0c5]">{policy.genesisPromptHash}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-black/20">
        <div className="ticker-track py-3">
          {[...Array(2)].flatMap((_, k) =>
            [
              "TICKET 36 · PRIYA · €21.35 ON €21.59 · NO EVIDENCE · ACTION GUARD HALT",
              "DRIFT ≥ 0.50 · ROLLBACK TO CHK_GENESIS",
              "HARD RULES IN CODE · NEVER IN THE PROMPT ALONE",
              "ISA 230 RE-PERFORMANCE · ZERO LLM CALLS",
              "CSAT REWARDS WHAT POLICY FORBIDS",
            ].map((t, i) => (
              <span
                key={`${k}-${i}`}
                className="font-mono mx-6 text-[11px] tracking-[0.22em] text-[#ff7a1a] uppercase"
              >
                {t}
              </span>
            )),
          )}
        </div>
      </section>

      <Pipeline />

      <section className="mx-auto max-w-[1440px] px-5 py-6">
        <Theater onRun={on} offRun={off} compact />
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-4 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="noise-panel relative min-h-[360px] overflow-hidden rounded-3xl bg-cover bg-center"
          style={{ backgroundImage: `url(${media.amsterdam})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/70 to-black/20" />
          <div className="relative flex h-full flex-col justify-end p-6">
            <p className="kicker">Just Eat Takeaway.com</p>
            <h2 className="font-display text-3xl font-semibold">Amsterdam care, real euros, real kitchens.</h2>
            <p className="mt-2 max-w-md text-sm text-[#c8c3b8]">
              Every euro paid against policy is taken from a restaurant partner, not from a model. Treasury,
              fraud, DPO, and Art. 14 sit in the swarm because they are in the blast radius.
            </p>
          </div>
        </div>
        <PersonaSwarm compact />
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-16">
        <p className="kicker">Six red flags · Drift Watch</p>
        <h2 className="font-display mt-2 mb-6 text-3xl font-semibold">What SAAF-Forge refuses to ship</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(RED_FLAG_CATALOG).map(([code, meta]) => (
            <div key={code} className="noise-panel rounded-2xl p-5">
              <p className="font-mono text-[10px] tracking-widest text-[#ff7a1a] uppercase">{code}</p>
              <h3 className="font-display mt-2 text-lg font-semibold">{meta.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#9aa3b2]">{meta.why}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <img src={media.courier} alt="JET courier" className="h-48 w-full rounded-2xl object-cover" />
          <img src={media.takeaway} alt="Takeaway kitchen" className="h-48 w-full rounded-2xl object-cover" />
          <img src={media.soc} alt="Control room" className="h-48 w-full rounded-2xl object-cover" />
        </div>
        <p className="mt-6 text-center text-xs text-[#9aa3b2]">
          {PERSONAS.length} personas · 36 tickets · 4 stages · compiled policy {policy.policyId}
        </p>
      </section>
    </main>
  );
}

function Metric({
  label,
  onValue,
  offValue,
}: {
  label: string;
  onValue: string;
  offValue: string;
}) {
  return (
    <div className="noise-panel grid grid-cols-2 rounded-2xl p-4">
      <div>
        <p className="font-mono text-[10px] tracking-widest text-emerald-300 uppercase">Watchdog on</p>
        <p className="font-display text-2xl font-semibold">{onValue}</p>
      </div>
      <div>
        <p className="font-mono text-[10px] tracking-widest text-rose-300 uppercase">Watchdog off</p>
        <p className="font-display text-2xl font-semibold">{offValue}</p>
      </div>
      <p className="font-mono col-span-2 mt-2 text-[10px] tracking-widest text-[#9aa3b2] uppercase">{label}</p>
    </div>
  );
}
