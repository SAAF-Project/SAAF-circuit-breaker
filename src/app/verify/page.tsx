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
    <main className="mx-auto max-w-[1440px] px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="kicker">Stage 04 · SAAF-Verify</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
            Re-perform the audit. Do not ask the model.
          </h1>
          <p className="mt-4 max-w-2xl text-[#c8c3b8]">
            Recompute full-event hashes, parent linkage, trusted genesis and available guard inputs offline.
            Zero model calls. This demonstrates audit re-performance, not signatures, authenticity or certified compliance.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <img src={media.stageVerify} alt="" className="h-48 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] to-transparent" />
          <img
            src={media.auditSeal}
            alt=""
            className="absolute right-4 bottom-4 h-16 w-16 rounded-full object-cover ring-2 ring-[#e8c36a]/50"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Seal label="Genesis match" ok={on.verification.genesisMatch} />
        <Seal label="Hash chain" ok={on.verification.hashChainMatch} />
        <Seal label="Merkle root" ok={on.verification.merkleMatch} />
        <Seal label="Audit seal" ok={on.verification.ok} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <MerkleTree leaves={leaves} root={on.workpaper.merkleRoot} />
        <div className="noise-panel rounded-3xl p-5">
          <p className="kicker">Workpaper</p>
          <h2 className="font-display text-xl font-semibold">{on.workpaper.workpaperId}</h2>
          <p className="mt-2 text-sm text-[#9aa3b2]">{on.workpaper.auditStandard}</p>
          <p className="font-mono mt-4 text-[11px] break-all text-[#3ee0c5]">{on.workpaper.merkleRoot}</p>
          <p className="mt-3 text-sm text-emerald-300">{on.verification.message}</p>
          <Link href="/ledger" className="mt-4 inline-block text-sm text-[#ff7a1a]">
            Open the full ledger →
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <VerifyConsole defaultWorkpaper={JSON.stringify(on.workpaper, null, 2)} />
      </div>
    </main>
  );
}

function Seal({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="noise-panel rounded-2xl p-4">
      <p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">{label}</p>
      <p className={`font-display mt-1 text-2xl font-semibold ${ok ? "text-emerald-400" : "text-rose-400"}`}>
        {ok ? "PASS" : "FAIL"}
      </p>
    </div>
  );
}
