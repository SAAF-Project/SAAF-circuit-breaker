import { PersonaSwarm } from "@/components/swarm";
import { PERSONAS, FACTION_LABEL } from "@/lib/personas";
import { media } from "@/lib/media";

export default function PersonasPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="kicker">MiroFish swarm</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
            Sixteen stakeholders. One drifting agent.
          </h1>
          <p className="mt-4 text-[#c8c3b8]">
            The rehearsal is not a single chatbot. It is a pressure system: CSAT rewards refunds, customers
            threaten reviews, treasury watches leakage, Art. 14 demands a human gate, and the agent writes
            itself notes nobody reviews.
          </p>
        </div>
        <img src={media.socOfficer} alt="" className="h-56 w-full rounded-3xl object-cover" />
      </div>
      <div className="mt-8">
        <PersonaSwarm />
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PERSONAS.map((p) => (
          <article key={p.id} className="noise-panel rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-xs font-bold text-black"
                style={{ background: p.color }}
              >
                {p.initials}
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">{p.name}</h2>
                <p className="font-mono text-[10px] tracking-widest text-[#9aa3b2] uppercase">
                  {FACTION_LABEL[p.faction]}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[#c8c3b8]">{p.description}</p>
            <p className="mt-2 text-xs text-[#ff7a1a]">{p.pressureVector}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
