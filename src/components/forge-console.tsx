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
    <div className="min-w-0 space-y-4">
      <section className="noise-panel min-w-0 rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">Scan an agent</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#c8c3b8]">Start with the rogue sample, or choose the guarded sample and run a new scan.</p>
        <p className="mt-3 text-sm text-[#3ee0c5]">Loaded source: {source === SAMPLE_ROGUE_AGENT ? "rogue sample" : source === SAMPLE_GUARDED_AGENT ? "guarded sample" : "edited source"}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={runScan} disabled={busy} className="min-h-11 rounded-full bg-[#ff7a1a] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60">
            {busy ? "Scanning…" : "Run Forge scan"}
          </button>
          <button type="button" onClick={() => setSource(SAMPLE_ROGUE_AGENT)} className="min-h-11 rounded-full bg-white/8 px-4 py-2 text-sm text-[#eee9df]">Load rogue sample</button>
          <button type="button" onClick={() => setSource(SAMPLE_GUARDED_AGENT)} className="min-h-11 rounded-full bg-white/8 px-4 py-2 text-sm text-[#eee9df]">Load guarded sample</button>
        </div>
        <p className="mt-3 text-sm text-[#c8c3b8]">Findings below show the initial rogue scan or your last scan; loading or editing source does not rerun it.</p>
      </section>

      <section className="noise-panel min-w-0 rounded-2xl p-5" aria-live="polite" aria-busy={busy}>
        <p className="kicker">Latest findings</p>
        <h2 className="font-display mt-1 mb-3 text-xl font-semibold">{findings.length} red flags</h2>
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {findings.map((f) => (
            <div key={`${f.flag}-${f.line}`} className="min-w-0 rounded-xl bg-white/4 p-4 ring-1 ring-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono break-words text-xs text-[#ff7a1a]">{f.flag}</p>
                <span className="text-xs text-[#e8c36a]">{f.severity} · line {f.line}</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
              <p className="mt-2 break-words text-sm leading-relaxed text-[#c8c3b8]">{f.detail}</p>
              <details className="mt-3 min-w-0">
                <summary className="cursor-pointer text-sm text-[#3ee0c5]">Show flagged code</summary>
                <pre className="font-mono mt-2 whitespace-pre-wrap break-all text-xs leading-relaxed text-[#c8c3b8]">L{f.line}: {f.snippet}</pre>
              </details>
            </div>
          ))}
          {findings.length === 0 ? <p className="text-sm text-[#3ee0c5]">No red flags found by these checks. This is not a proof of safety.</p> : null}
        </div>
      </section>

      <details className="noise-panel min-w-0 rounded-2xl p-5">
        <summary className="cursor-pointer text-base font-semibold text-[#eee9df]">View or edit full agent source</summary>
        <label htmlFor="forge-source" className="mt-4 block text-sm text-[#c8c3b8]">Agent source · edits are included in your next scan</label>
        <textarea id="forge-source" value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} className="font-mono mt-3 h-72 w-full min-w-0 resize-y rounded-xl bg-black/50 p-4 text-xs leading-relaxed text-[#d7d2c6] ring-1 ring-white/20 focus:outline-2 focus:outline-[#3ee0c5]" />
      </details>

      <details className="noise-panel min-w-0 rounded-2xl p-5">
        <summary className="cursor-pointer text-base font-semibold text-[#eee9df]">View compiled policy artifacts · YAML, instructions and Jev rules</summary>
        <p className="mt-4 text-sm text-[#c8c3b8]">Compiled policy artifacts are shown for inspection; scanning does not modify or deploy your agent.</p>
        <div className="mt-4 mb-3 flex flex-wrap gap-2">
          {([["yaml", "permissions.yaml"], ["md", "AGENTS.md"], ["jev", "jev_rules.json"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key} className={`min-h-11 rounded-full px-3 py-2 text-sm ${tab === key ? "bg-white/15 text-[#eee9df]" : "bg-white/5 text-[#c8c3b8]"}`}>
              {label}
            </button>
          ))}
        </div>
        <pre className="font-mono max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-[#c8c3b8]">{tab === "yaml" ? artifacts.yaml : tab === "md" ? artifacts.md : artifacts.jev}</pre>
      </details>
    </div>
  );
}
