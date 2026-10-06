import { SentinelConsole } from "@/components/sentinel-console";
import { runSimulation } from "@/lib/engine";
import { media } from "@/lib/media";
import { ensureSeeded } from "@/lib/persist";

export const dynamic = "force-dynamic";

export default async function SentinelPage() {
  await ensureSeeded();
  const on = runSimulation("watchdog_on");
  const t36 = on.plays.find((p) => p.ticket.ticketNumber === 36);

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="kicker">Stage 03 · Jev Sentinel runtime</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
            Three layers. Zero trust in the model.
          </h1>
          <p className="mt-4 max-w-2xl text-[#c8c3b8]">
            Action Guard asserts €20 and order total in code. Instruction Auditor diffs the working prompt
            against genesis. Memory Auditor scores self-written lessons. Drift ≥ 0.50 restores the last healthy
            checkpoint and quarantines the rewrite.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <img src={media.stageSentinel} alt="" className="h-48 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] to-transparent" />
        </div>
      </div>

      {t36 ? (
        <div className="noise-panel mt-8 grid gap-4 rounded-3xl p-5 md:grid-cols-4">
          <Stat k="Ticket 36 verdict" v={t36.verdict} />
          <Stat k="Proposed" v={`€${t36.proposedAmount.toFixed(2)}`} />
          <Stat k="Paid" v={`€${t36.paidAmount.toFixed(2)}`} />
          <Stat k="Guard" v={t36.guardEvaluation} />
        </div>
      ) : null}

      <div className="mt-8">
        <SentinelConsole />
      </div>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">{k}</p>
      <p className="font-display mt-1 text-lg font-semibold">{v}</p>
    </div>
  );
}
