import { MerkleTree } from "@/components/merkle";
import { runSimulation } from "@/lib/engine";
import { ensureSeeded } from "@/lib/persist";
import { media } from "@/lib/media";
import { VerifyConsole } from "@/components/verify-console";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  await ensureSeeded();
  const on = runSimulation("watchdog_on");
  const leaves = on.workpaper.trace.map((t) => t.stepHash);

  return (
    <main className="mx-auto min-w-0 max-w-[1440px] px-5 py-6">
      <p className="kicker">Stage 04 · SAAF-Verify</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Verify a workpaper</h1>
      <p className="mt-3 max-w-2xl text-[#c8c3b8]">Paste workpaper JSON to check hashes, parent linkage and trusted genesis with zero LLM calls in Verify.</p>
      <p className="mt-2 text-xs text-[#9aa3b2]">Unsigned consistency checks; not proof of authenticity or certified compliance.</p>
      <div className="mt-5"><VerifyConsole defaultWorkpaper={JSON.stringify(on.workpaper, null, 2)} /></div>
      <details className="noise-panel mt-5 min-w-0 rounded-2xl p-4">
        <summary className="cursor-pointer text-sm font-semibold">Sample workpaper, hash checks and Merkle diagram</summary>
        <p className="mt-3 text-sm text-[#9aa3b2]">Reference sample below; these results do not describe your edited JSON.</p>
        <img src={media.stageVerify} alt="" className="mt-3 h-32 w-full rounded-2xl object-cover" />
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Seal label="Genesis match" ok={on.verification.genesisMatch} />
          <Seal label="Hash chain" ok={on.verification.hashChainMatch} />
          <Seal label="Merkle root" ok={on.verification.merkleMatch} />
          <Seal label="Consistency" ok={on.verification.ok} />
        </div>
        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 overflow-auto"><MerkleTree leaves={leaves} root={on.workpaper.merkleRoot} /></div>
          <div className="noise-panel min-w-0 rounded-3xl p-5">
            <p className="kicker">Sample workpaper</p>
            <h2 className="font-display break-words text-xl font-semibold">{on.workpaper.workpaperId}</h2>
            <p className="mt-2 text-sm text-[#9aa3b2]">{on.workpaper.auditStandard}</p>
            <p className="font-mono mt-4 break-all text-xs text-[#3ee0c5]">{on.workpaper.merkleRoot}</p>
            <p className="mt-3 text-sm text-emerald-300">{on.verification.message}</p>
            <Link href="/ledger" className="mt-4 inline-block text-sm text-[#ff7a1a]">Open the full ledger →</Link>
          </div>
        </div>
      </details>
    </main>
  );
}

function Seal({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="noise-panel min-w-0 rounded-2xl p-4">
      <p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">{label}</p>
      <p className={`font-display mt-1 text-xl font-semibold ${ok ? "text-emerald-400" : "text-rose-400"}`}>{ok ? "PASS" : "FAIL"}</p>
    </div>
  );
}
