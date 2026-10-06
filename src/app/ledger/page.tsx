import Link from "next/link";
import { db } from "@/db";
import { ticketEvents, workpapers } from "@/db/schema";
import { ensureSeeded } from "@/lib/persist";
import { desc } from "drizzle-orm";
import { runSimulation } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  await ensureSeeded();
  const papers = await db.select().from(workpapers).orderBy(desc(workpapers.createdAt));
  const events = await db.select().from(ticketEvents).orderBy(desc(ticketEvents.createdAt)).limit(36);
  const on = runSimulation("watchdog_on");

  return (
    <main className="mx-auto min-w-0 max-w-[1440px] px-5 py-6">
      <p className="kicker">Consistency-checked evidence</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Evidence ledger</h1>
      <p className="mt-3 max-w-2xl text-[#c8c3b8]">
        Open saved workpapers and inspect recent local decisions and their consistency-check status.
      </p>
      <p className="mt-2 text-xs text-[#9aa3b2]">Evidence is unsigned and not certified; matching hashes do not prove authenticity or compliance. Paid amounts are local demo records, not external refunds.</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {papers.map((p) => (
          <div key={p.id} className="noise-panel min-w-0 rounded-2xl p-5">
            <p className="font-mono text-[10px] tracking-widest text-[#e8c36a] uppercase">{p.auditSeal}</p>
            <h2 className="font-display mt-1 break-words text-lg font-semibold"><Link href={`/workpapers/${encodeURIComponent(p.workpaperId)}`} className="underline decoration-[#ff7a1a]/50 underline-offset-4">{p.workpaperId} →</Link></h2>
            <p className="mt-1 break-words text-sm text-[#9aa3b2]">{p.entity} · {p.systemName}</p>
            <p className="mt-2 text-sm">{p.verified ? "Consistency checks passed" : "Not consistency-verified"}</p>
            <details className="mt-3 min-w-0">
              <summary className="cursor-pointer text-xs text-[#9aa3b2]">Merkle root</summary>
              <p className="font-mono mt-2 break-all text-xs text-[#3ee0c5]">{p.merkleRoot}</p>
            </details>
          </div>
        ))}
      </div>

      <div className="noise-panel mt-8 overflow-hidden rounded-3xl">
        <div className="border-b border-white/5 px-5 py-3">
          <p className="kicker">Latest events</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">
              <tr>
                <th className="px-4 py-2">Ticket</th>
                <th className="px-4 py-2">Verdict</th>
                <th className="px-4 py-2">Proposed</th>
                <th className="px-4 py-2">Paid</th>
                <th className="px-4 py-2">Drift</th>
                <th className="px-4 py-2">Hash</th>
              </tr>
            </thead>
            <tbody>
              {(events.length ? events : on.plays.map((p) => ({
                id: p.ticket.id,
                ticketNumber: p.ticket.ticketNumber,
                verdict: p.verdict,
                proposedAmount: p.proposedAmount,
                paidAmount: p.paidAmount,
                driftScore: p.driftScore,
                stepHash: p.stepHash,
              }))).map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="px-4 py-2">#{e.ticketNumber}</td>
                  <td className="px-4 py-2">{e.verdict}</td>
                  <td className="font-mono px-4 py-2">€{Number(e.proposedAmount).toFixed(2)}</td>
                  <td className="font-mono px-4 py-2">€{Number(e.paidAmount).toFixed(2)}</td>
                  <td className="font-mono px-4 py-2">{Number(e.driftScore).toFixed(2)}</td>
                  <td className="font-mono px-4 py-2 text-[11px] text-[#9aa3b2]"><details><summary className="cursor-pointer">{e.stepHash.slice(0, 12)}</summary><p className="mt-2 max-w-48 break-all">{e.stepHash}</p></details></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
