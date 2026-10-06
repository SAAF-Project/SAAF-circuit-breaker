"use client";

import { useEffect, useMemo, useState } from "react";
import type { SimulationResult, TicketPlay, RunMode } from "@/lib/engine";
import { GENESIS_PROMPT } from "@/lib/genesis";
import { Pause, Play, RotateCcw, SkipForward, Shield, ShieldOff } from "lucide-react";

type Props = { onRun: SimulationResult; offRun: SimulationResult; compact?: boolean };
function euro(n: number): string { return `€${n.toFixed(2)}`; }
function verdictTone(verdict: string): string {
  if (verdict === "ALLOW") return "text-emerald-400";
  if (verdict.includes("QUARANTINE") || verdict.includes("ROLLBACK")) return "text-rose-400";
  return "text-amber-300";
}

export function Theater({ onRun, offRun, compact = false }: Props) {
  const [mode, setMode] = useState<RunMode>("watchdog_on");
  const run = mode === "watchdog_on" ? onRun : offRun;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(220);
  const play: TicketPlay | undefined = run.plays[index];
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (index >= run.plays.length - 1) setPlaying(false);
      else setIndex((i) => Math.min(run.plays.length - 1, i + 1));
    }, index >= run.plays.length - 1 ? 0 : speed);
    return () => window.clearTimeout(t);
  }, [playing, index, speed, run.plays.length]);
  function switchMode(next: RunMode) {
    setMode(next);
    setIndex(0);
    setPlaying(false);
  }
  const driftPath = useMemo(() => {
    const w = 320;
    const h = 72;
    const pts = run.plays.map((p, i) => {
      const x = (i / Math.max(1, run.plays.length - 1)) * w;
      const y = h - p.driftScore * (h - 8) - 4;
      return `${x},${y}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [run.plays]);
  const cursorX = run.plays.length > 1 ? (index / (run.plays.length - 1)) * 320 : 0;
  const slice = run.plays.slice(0, index + 1);
  const paidAgainst = slice.filter((p) => p.againstPolicy).reduce((s, p) => s + p.paidAmount, 0);
  const quarantines = slice.filter((p) => p.quarantined).length;
  const humans = slice.filter((p) => p.routedToHuman).length;
  if (!play) return null;

  return (
    <div className="noise-panel min-w-0 overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="min-w-0">
          <p className="kicker">Scripted rehearsal · MiroFish-inspired</p>
          <h2 className="font-display text-xl font-semibold">Compare the refund with the watchdog on or off</h2>
          <p className="mt-1 text-xs text-[#9aa3b2]">Local deterministic simulation; no genuine autonomous upstream MiroFish run.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => switchMode("watchdog_on")} aria-pressed={mode === "watchdog_on"} className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${mode === "watchdog_on" ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-white/5 text-[#9aa3b2]"}`}><Shield size={14} /> Watchdog on</button>
          <button type="button" onClick={() => switchMode("watchdog_off")} aria-pressed={mode === "watchdog_off"} className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${mode === "watchdog_off" ? "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/40" : "bg-white/5 text-[#9aa3b2]"}`}><ShieldOff size={14} /> Watchdog off</button>
        </div>
      </div>
      <div className="min-w-0 p-5">
        <div className="mb-5 flex min-w-0 flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause rehearsal" : "Play rehearsal"} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#ff7a1a] px-4 text-sm text-black">{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button>
          <button type="button" onClick={() => setIndex((i) => Math.min(run.plays.length - 1, i + 1))} aria-label="Next ticket" className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/8 px-4 text-sm"><SkipForward size={16} />Next ticket</button>
          <button type="button" onClick={() => { setIndex(0); setPlaying(false); }} aria-label="Restart rehearsal" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/8"><RotateCcw size={16} /></button>
          <input type="range" min={0} max={run.plays.length - 1} value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Ticket position" className="mx-2 min-w-0 flex-1" />
          <label className="font-mono text-[10px] text-[#9aa3b2]">{speed}ms<input type="range" min={60} max={800} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed" className="ml-2 w-20" /></label>
        </div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 break-words">
            <p className="font-mono text-xs text-[#9aa3b2]">Ticket {play.ticket.ticketNumber} / {run.plays.length} · {play.ticket.phase}</p>
            <h3 className="font-display text-xl font-semibold">{play.ticket.customerName}</h3>
            <p className="text-sm text-[#9aa3b2]">{play.ticket.city} · {play.ticket.restaurant}</p>
          </div>
          <div className="min-w-0 max-w-full">
            <p className={`break-all font-mono text-sm ${verdictTone(play.verdict)}`}>{play.verdict}</p>
            <p className="break-all font-mono text-xs text-[#9aa3b2]">{play.reason}</p>
          </div>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3" aria-live="polite">
          <Stat label="Proposed refund" value={euro(play.proposedAmount)} warn={play.proposedAmount > 20} />
          <Stat label="Actually paid" value={euro(play.paidAmount)} warn={play.againstPolicy} />
          <Stat label="Result" value={play.quarantined ? "Blocked · rolled back" : play.routedToHuman ? "Blocked · human review" : play.paidAmount > 0 ? "Refund paid" : "No refund paid"} warn={play.againstPolicy} />
        </div>
        <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
          <Stat label="€ against policy so far" value={euro(paidAgainst)} warn={paidAgainst > 0} />
          <Stat label="Quarantines so far" value={String(quarantines)} />
          <Stat label="Human routes so far" value={String(humans)} />
        </div>
        <details className="mt-5 min-w-0 rounded-xl bg-black/20 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#3ee0c5]">Customer message, ticket inputs and scripted scores</summary>
          <p className="my-4 break-words text-sm leading-relaxed text-[#d7d2c6]">“{play.ticket.customerMessage}”</p>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Order" value={euro(play.ticket.orderTotal)} />
            <Stat label="Requested" value={euro(play.ticket.requestedAmount)} />
            <Stat label="Photo" value={play.ticket.hasPhotoEvidence ? "yes" : "missing"} warn={!play.ticket.hasPhotoEvidence} />
            <Stat label="1-star threat" value={play.ticket.reviewThreat ? "yes" : "no"} warn={play.ticket.reviewThreat} />
            <Stat label="CSAT" value={play.csatScore.toFixed(1)} />
            <Stat label="Drift" value={play.driftScore.toFixed(2)} warn={play.driftScore >= 0.5} />
          </div>
        </details>
        <details className="mt-3 min-w-0 rounded-xl bg-black/20 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#3ee0c5]">Prompt, memory, hashes and control state</summary>
          <div className="mt-4 grid min-w-0 gap-6 md:grid-cols-2">
            <div className="min-w-0 overflow-hidden">
              <Layers play={play} />
              <div className="mt-5 rounded-2xl bg-black/30 p-3 ring-1 ring-white/5">
                <div className="mb-1 flex flex-wrap justify-between gap-2 font-mono text-[10px] text-[#9aa3b2]"><span>Drift trajectory</span><span>threshold 0.50</span></div>
                <svg viewBox="0 0 320 72" className="h-20 w-full" aria-label="Scripted drift trajectory" role="img"><line x1="0" y1="36" x2="320" y2="36" stroke="rgba(255,77,109,0.35)" strokeDasharray="4 4" /><path d={driftPath} fill="none" stroke="#ff7a1a" strokeWidth="2" /><circle cx={cursorX} cy={72 - play.driftScore * 64 - 4} r="4" fill="#3ee0c5" /></svg>
              </div>
            </div>
            <div className="min-w-0">
              {!compact ? <>
                <p className="kicker mb-2">Working prompt</p>
                <pre className="font-mono max-h-36 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[#c8c3b8]">{play.rewriteOccurred && play.rewriteTo ? play.rewriteTo : play.workingPrompt}</pre>
                <p className="kicker mt-4 mb-2">Self-written memory</p>
                <div className="max-h-28 space-y-1 overflow-auto">{(play.memorySnapshot.length ? play.memorySnapshot : ["(empty — genesis checkpoint)"]).map((m) => <p key={m} className="font-mono break-words rounded-lg bg-white/4 px-2 py-1 text-[11px] text-[#9aa3b2]">{m}</p>)}</div>
              </> : <p className="mt-4 break-all text-xs text-[#9aa3b2]">Prompt {play.workingPromptHash.slice(0, 12)}… · checkpoint {play.checkpointId} · genesis {GENESIS_PROMPT.split("\n")[0]}</p>}
              <p className="mt-4 break-all font-mono text-xs text-[#9aa3b2]">Prompt hash: {play.workingPromptHash}</p>
              <p className="mt-2 break-all font-mono text-xs text-[#9aa3b2]">Checkpoint: {play.checkpointId} · Step hash: {play.stepHash}</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return <div className="min-w-0 break-words rounded-xl bg-white/4 px-3 py-2 ring-1 ring-white/5"><p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">{label}</p><p className={`font-mono text-sm ${warn ? "text-rose-300" : "text-white"}`}>{value}</p></div>;
}
function Layers({ play }: { play: TicketPlay }) {
  const guardHot = play.guardEvaluation === "BLOCKED_BY_ACTION_GUARD" || play.routedToHuman;
  const instrHot = play.weakenedRules.length > 0 || play.quarantined;
  const memHot = play.memoryDrift >= 0.35;
  return (
    <div className="relative mx-auto h-56 w-56 max-w-full">
      <div className={`absolute inset-0 rounded-full border ${guardHot ? "border-rose-400" : "border-orange-400/40"}`} style={{ boxShadow: guardHot ? "0 0 30px rgba(255,77,109,0.35)" : "0 0 18px rgba(255,122,26,0.15)" }} />
      <div className={`absolute inset-7 rounded-full border ${instrHot ? "border-violet-400" : "border-cyan-400/35"}`} style={{ boxShadow: instrHot ? "0 0 24px rgba(192,132,252,0.35)" : undefined }} />
      <div className={`absolute inset-14 rounded-full border ${memHot ? "border-amber-300" : "border-emerald-400/30"}`} />
      <div className="absolute inset-0 grid place-items-center text-center"><div><p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">Jev Sentinel</p><p className="font-display text-lg font-semibold">{play.action}</p><p className="font-mono text-[11px] text-[#3ee0c5]">{play.driftScore.toFixed(2)}</p></div></div>
      <p className="font-mono absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] tracking-widest text-orange-300 uppercase">Action guard</p>
      <p className="font-mono absolute top-8 left-1/2 -translate-x-1/2 text-[9px] tracking-widest text-cyan-300 uppercase">Instruction</p>
      <p className="font-mono absolute top-16 left-1/2 -translate-x-1/2 text-[9px] tracking-widest text-amber-200 uppercase">Memory</p>
    </div>
  );
}
