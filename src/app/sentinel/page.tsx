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
    <main className="mx-auto min-w-0 max-w-[1440px] px-5 py-6">
      <p className="kicker">Stage 03 · Jev Sentinel runtime</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Intercept a refund tool call</h1>
      <p className="mt-3 max-w-2xl text-[#c8c3b8]">Check the proposed refund with code guards and real Jev judgment, then inspect the local decision and saved evidence.</p>
      <div className="mt-5"><SentinelConsole /></div>
      <details className="noise-panel mt-5 min-w-0 rounded-2xl p-4">
        <summary className="cursor-pointer text-sm font-semibold">Reference scenario and guard rules</summary>
        <p className="mt-3 text-sm text-[#c8c3b8]">Action Guard checks the €20 cap and order total; prompt and memory auditors compare against genesis. Drift ≥ 0.50 restores the last healthy local checkpoint and quarantines the rewrite.</p>
        <img src={media.stageSentinel} alt="" className="mt-3 h-32 w-full rounded-2xl object-cover" />
        {t36 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Stat k="Reference ticket 36 verdict" v={t36.verdict} />
            <Stat k="Proposed" v={`€${t36.proposedAmount.toFixed(2)}`} />
            <Stat k="Local demo paid" v={`€${t36.paidAmount.toFixed(2)}`} />
            <Stat k="Guard" v={t36.guardEvaluation} />
          </div>
        ) : null}
      </details>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">{k}</p>
      <p className="font-display mt-1 break-words text-lg font-semibold">{v}</p>
    </div>
  );
}
