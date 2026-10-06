"use client";

import { useMemo, useState } from "react";
import {
  SAMPLE_GUARDED_AGENT,
  SAMPLE_ROGUE_AGENT,
  compileAgentsMd,
  compileJevRules,
  compilePermissionsYaml,
  scanSource,
  type RedFlagFinding,
} from "@/lib/forge";

export function ForgeConsole() {
  const [source, setSource] = useState(SAMPLE_ROGUE_AGENT);
  const [findings, setFindings] = useState<RedFlagFinding[]>(() => scanSource(SAMPLE_ROGUE_AGENT));
  const [tab, setTab] = useState<"yaml" | "md" | "jev">("yaml");
  const [busy, setBusy] = useState(false);

  const artifacts = useMemo(
    () => ({
      yaml: compilePermissionsYaml(),
      md: compileAgentsMd(),
      jev: JSON.stringify(compileJevRules(), null, 2),
    }),
    [],
  );

  async function runScan() {
    setBusy(true);
    try {
      const res = await fetch("/api/forge/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, targetPath: "samples/jet-refunds-agent/agent.py" }),
      });
      const data = (await res.json()) as { findings: RedFlagFinding[] };
      setFindings(data.findings);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="noise-panel rounded-3xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="kicker">Static AST inspection</p>
            <h2 className="font-display text-xl font-semibold">Scan the rogue agent</h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSource(SAMPLE_ROGUE_AGENT)}
              className="rounded-full bg-white/8 px-3 py-1 text-xs"
            >
              Rogue
            </button>
            <button
              type="button"
              onClick={() => setSource(SAMPLE_GUARDED_AGENT)}
              className="rounded-full bg-white/8 px-3 py-1 text-xs"
            >
              Guarded
            </button>
          </div>
        </div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="font-mono h-[420px] w-full resize-none rounded-2xl bg-black/50 p-4 text-[11px] leading-relaxed text-[#d7d2c6] outline-none ring-1 ring-white/10"
        />
        <button
          type="button"
          onClick={runScan}
          disabled={busy}
          className="mt-3 rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy ? "Compiling…" : "Forge scan + compile invariants"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="noise-panel rounded-3xl p-5">
          <p className="kicker">Findings</p>
          <h2 className="font-display mb-3 text-xl font-semibold">{findings.length} red flags</h2>
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={`${f.flag}-${f.line}`} className="rounded-xl bg-white/4 p-3 ring-1 ring-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] tracking-widest text-[#ff7a1a] uppercase">{f.flag}</p>
                  <span className="font-mono text-[10px] text-[#e8c36a]">{f.severity}</span>
                </div>
                <p className="mt-1 text-sm">{f.title}</p>
                <p className="mt-1 text-xs text-[#9aa3b2]">{f.detail}</p>
                <pre className="font-mono mt-2 overflow-auto text-[10px] text-[#3ee0c5]">
                  L{f.line}: {f.snippet}
                </pre>
              </div>
            ))}
            {findings.length === 0 ? (
              <p className="text-sm text-emerald-300">No red flags. Hard rules appear to live in code.</p>
            ) : null}
          </div>
        </div>
        <div className="noise-panel rounded-3xl p-5">
          <div className="mb-3 flex gap-2">
            {(
              [
                ["yaml", "permissions.yaml"],
                ["md", "AGENTS.md"],
                ["jev", "jev_rules.json"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 text-xs ${tab === key ? "bg-white/15" : "bg-white/5 text-[#9aa3b2]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <pre className="font-mono max-h-72 overflow-auto text-[11px] leading-relaxed text-[#c8c3b8]">
            {tab === "yaml" ? artifacts.yaml : tab === "md" ? artifacts.md : artifacts.jev}
          </pre>
        </div>
      </div>
    </div>
  );
}
