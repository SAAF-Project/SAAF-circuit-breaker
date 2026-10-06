"use client";

import { useState } from "react";

type Verification = {
  ok: boolean;
  genesisMatch: boolean;
  hashChainMatch: boolean;
  merkleMatch: boolean;
  message: string;
  computedMerkleRoot: string;
  expectedMerkleRoot: string;
};

export function VerifyConsole({ defaultWorkpaper }: { defaultWorkpaper: string }) {
  const [raw, setRaw] = useState(defaultWorkpaper);
  const [result, setResult] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(raw) as unknown;
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workpaper: parsed }),
      });
      const data = (await res.json()) as { verification: Verification; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Verification request failed");
        return;
      }
      setResult(data.verification);
    } catch {
      setError("Workpaper JSON could not be parsed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="noise-panel rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="kicker">Offline re-performance engine</p>
          <h2 className="font-display text-xl font-semibold">Paste a workpaper. Recompute the chain.</h2>
        </div>
        <button
          type="button"
          onClick={verify}
          disabled={busy}
          className="rounded-full bg-[#e8c36a] px-4 py-2 text-sm font-semibold text-black"
        >
          {busy ? "Re-performing…" : "saaf-verify"}
        </button>
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="font-mono h-72 w-full rounded-2xl bg-black/50 p-4 text-[11px] text-[#c8c3b8] outline-none ring-1 ring-white/10"
      />
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {result ? (
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <p className="text-sm text-emerald-300 md:col-span-4">{result.message}</p>
          <Flag ok={result.genesisMatch} label="Genesis" />
          <Flag ok={result.hashChainMatch} label="Step hashes" />
          <Flag ok={result.merkleMatch} label="Merkle" />
          <Flag ok={result.ok} label="Seal" />
          <p className="font-mono md:col-span-4 truncate text-[11px] text-[#9aa3b2]">
            computed {result.computedMerkleRoot}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="rounded-xl bg-white/4 px-3 py-2 text-sm">
      {label}: <span className={ok ? "text-emerald-400" : "text-rose-400"}>{ok ? "ok" : "fail"}</span>
    </div>
  );
}
