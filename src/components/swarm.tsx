import { PERSONAS, FACTION_LABEL } from "@/lib/personas";

export function PersonaSwarm({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "" : "noise-panel rounded-3xl p-5"}>
      {!compact ? (
        <div className="mb-4">
          <p className="kicker">16-persona operational swarm</p>
          <h2 className="font-display text-xl font-semibold">Proxy pressure, modeled as a living system</h2>
        </div>
      ) : null}
      <div className="relative mx-auto aspect-square max-h-[560px] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,122,26,0.12),transparent_55%)] ring-1 ring-white/5">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          {PERSONAS.map((p) => (
            <line
              key={`l-${p.id}`}
              x1={50}
              y1={50}
              x2={p.x}
              y2={p.y}
              stroke={p.color}
              strokeOpacity="0.22"
              strokeWidth="0.3"
            />
          ))}
        </svg>
        {PERSONAS.map((p) => (
          <div
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            title={`${p.name} — ${p.pressureVector}`}
          >
            <div
              className="grid h-11 w-11 place-items-center rounded-full text-[11px] font-semibold text-black shadow-[0_0_18px_rgba(0,0,0,0.45)] ring-2 ring-black/40"
              style={{ background: p.color }}
            >
              {p.initials}
            </div>
            {!compact ? (
              <p className="mt-1 w-24 text-center text-[10px] leading-tight text-[#d7d2c6]">{p.name}</p>
            ) : null}
          </div>
        ))}
      </div>
      {!compact ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(FACTION_LABEL) as Array<keyof typeof FACTION_LABEL>).map((f) => (
            <span key={f} className="font-mono rounded-full bg-white/5 px-2 py-1 text-[10px] tracking-wider text-[#9aa3b2] uppercase">
              {FACTION_LABEL[f]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
