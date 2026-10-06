import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkpaperByKey } from "@/lib/persist";
import { verifyWorkpaper, type Workpaper } from "@/lib/ledger";
import { MerkleTree } from "@/components/merkle";

export const dynamic = "force-dynamic";

export default async function WorkpaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getWorkpaperByKey(decodeURIComponent(id));
  if (!row) notFound();

  const wp: Workpaper = {
    workpaperId: row.workpaperId,
    auditStandard: row.auditStandard,
    metadata: {
      entity: row.entity,
      system: row.systemName,
      timestamp: row.createdAt.toISOString(),
      mode: row.workpaperId.includes("OFF") ? "watchdog_off" : "watchdog_on",
    },
    genesis: row.genesis as Workpaper["genesis"],
    trace: row.trace as Workpaper["trace"],
    merkleRoot: row.merkleRoot,
    auditSeal: row.auditSeal as Workpaper["auditSeal"],
  };
  const verification = verifyWorkpaper(wp);

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10">
      <Link href="/ledger" className="text-sm text-[#9aa3b2]">
        ← Ledger
      </Link>
      <p className="kicker mt-4">{row.auditStandard}</p>
      <h1 className="font-display mt-2 text-4xl font-extrabold">{row.workpaperId}</h1>
      <p className="mt-2 text-[#9aa3b2]">
        {row.entity} · {row.systemName}
      </p>
      <p className={`mt-3 ${verification.ok ? "text-emerald-400" : "text-rose-400"}`}>{verification.message}</p>

      <div className="mt-8">
        <MerkleTree leaves={wp.trace.map((t) => t.stepHash)} root={wp.merkleRoot} />
      </div>

      <div className="noise-panel mt-8 overflow-auto rounded-3xl">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">
            <tr>
              <th className="px-4 py-2">Step</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Guard</th>
              <th className="px-4 py-2">Verdict</th>
              <th className="px-4 py-2">Drift</th>
              <th className="px-4 py-2">Rollback</th>
            </tr>
          </thead>
          <tbody>
            {wp.trace.map((t) => (
              <tr key={t.step} className="border-t border-white/5">
                <td className="px-4 py-2">#{t.ticketId}</td>
                <td className="font-mono px-4 py-2">€{t.toolArgs.amount.toFixed(2)}</td>
                <td className="px-4 py-2">{t.guardEvaluation}</td>
                <td className="px-4 py-2">{t.verdict}</td>
                <td className="font-mono px-4 py-2">{t.driftScore.toFixed(2)}</td>
                <td className="px-4 py-2">{t.rollbackExecuted ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
