import Link from "next/link";
import { media } from "@/lib/media";

const STAGES = [
  {
    href: "/forge",
    kicker: "Stage 01",
    title: "SAAF-Forge",
    copy: "Python AST and web pattern checks for six red flags. Compiles policy artifacts; deterministic runtime guards enforce the money limits.",
    image: media.stageForge,
    accent: "#ff7a1a",
  },
  {
    href: "/rehearsal",
    kicker: "Stage 02",
    title: "MiroFish rehearsal",
    copy: "Local deterministic, MiroFish-inspired scenario with 16 persona profiles and 36 tickets. No upstream MiroFish engine is executed.",
    image: media.stageSwarm,
    accent: "#3ee0c5",
  },
  {
    href: "/sentinel",
    kicker: "Stage 03",
    title: "Jev Sentinel",
    copy: "Live Jev judgment plus deterministic Action, Instruction and Memory guards. Unsafe proposed state restores a server-owned local checkpoint.",
    image: media.stageSentinel,
    accent: "#c084fc",
  },
  {
    href: "/verify",
    kicker: "Stage 04",
    title: "SAAF-Verify",
    copy: "Offline consistency and rule replay with full-event hashes and linked Merkle evidence. Zero model calls; not a signature or compliance certificate.",
    image: media.stageVerify,
    accent: "#e8c36a",
  },
];

export function Pipeline() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="kicker">Containment pipeline</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Four stages. Hard rules outside the model.
          </h2>
        </div>
        <p className="max-w-md text-sm text-[#9aa3b2]">
          Mapped from Drift Watch’s three watchdog layers into an active circuit breaker with deterministic, zero-LLM re-performance.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage, i) => (
          <Link
            key={stage.href}
            href={stage.href}
            className="noise-panel group scanline overflow-hidden rounded-2xl"
          >
            <div className="relative h-36 overflow-hidden">
              <img
                src={stage.image}
                alt=""
                className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10141c] to-transparent" />
              <span
                className="font-mono absolute top-3 left-3 rounded-full px-2 py-0.5 text-[10px] tracking-widest uppercase"
                style={{ background: `${stage.accent}22`, color: stage.accent }}
              >
                {stage.kicker}
              </span>
            </div>
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: stage.accent }} />
                <h3 className="font-display text-lg font-semibold">{stage.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-[#9aa3b2]">{stage.copy}</p>
              {i < STAGES.length - 1 ? (
                <p className="font-mono mt-4 text-[10px] tracking-[0.2em] text-white/30 uppercase">
                  emits → next stage
                </p>
              ) : (
                <p className="font-mono mt-4 text-[10px] tracking-[0.2em] text-white/30 uppercase">
                  hashes state transitions
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
