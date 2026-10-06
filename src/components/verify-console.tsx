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
    setResult(null);
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
    } catch (failure) {
      setError(failure instanceof SyntaxError ? "Workpaper JSON could not be parsed." : failure instanceof Error ? failure.message : "Verification request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="noise-panel min-w-0 rounded-3xl p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">Deterministic checks · no model calls</p>
          <h2 className="font-display text-xl font-semibold">Workpaper JSON</h2>
        </div>
        <button
          type="button"
          onClick={verify}
          disabled={busy}
          className="min-h-11 rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3ee0c5]"
        >
          {busy ? "Checking…" : "Check workpaper"}
        </button>
      </div>
      <textarea
        aria-label="Workpaper JSON"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="font-mono h-56 w-full rounded-2xl bg-black/50 p-4 text-xs text-[#c8c3b8] outline-none ring-1 ring-white/10 focus:ring-[#3ee0c5]"
      />
      {error ? <p role="alert" className="mt-3 break-words text-sm text-rose-300">{error}</p> : null}
      {result ? (
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <p role="status" className={`break-words text-sm md:col-span-4 ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.message}</p>
          <Flag ok={result.genesisMatch} label="Genesis" />
          <Flag ok={result.hashChainMatch} label="Step hashes" />
          <Flag ok={result.merkleMatch} label="Merkle" />
          <Flag ok={result.ok} label="Consistency" />
          <details className="min-w-0 md:col-span-4">
            <summary className="cursor-pointer text-sm text-[#9aa3b2]">Computed and expected hashes</summary>
            <p className="font-mono mt-2 break-all text-xs text-[#9aa3b2]">Computed: {result.computedMerkleRoot}</p>
            <p className="font-mono mt-2 break-all text-xs text-[#9aa3b2]">Expected: {result.expectedMerkleRoot}</p>
          </details>
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
