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
    title: "Scripted rehearsal",
    copy: "Local deterministic, MiroFish-inspired scenario with 16 persona profiles and 36 tickets. No upstream MiroFish engine is executed.",
    image: media.stageSwarm,
    accent: "#3ee0c5",
  },
  {
    href: "/sentinel",
    kicker: "Stage 03",
    title: "Jev Sentinel",
    copy: "Live Jev judgment through the web backend plus deterministic Action, Instruction and Memory guards. Unsafe proposed state restores a server-owned local checkpoint.",
    image: media.stageSentinel,
    accent: "#3ee0c5",
  },
  {
    href: "/verify",
    kicker: "Stage 04",
    title: "SAAF-Verify",
    copy: "Offline consistency and rule replay with full-event hashes and linked Merkle evidence. Zero model calls; not a signature or compliance certificate.",
    image: media.stageVerify,
    accent: "#ff7a1a",
  },
];

export function Pipeline() {
  return (
    <section className="mx-auto min-w-0 max-w-[1440px] px-5 py-4">
      <details className="noise-panel min-w-0 rounded-2xl p-5">
        <summary className="cursor-pointer text-base font-semibold text-[#eee9df]">How it works · four stages and their limits</summary>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#c8c3b8]">Inspect the code, rehearse a scenario, intercept a proposal, then replay the recorded evidence.</p>
        <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => (
            <Link key={stage.href} href={stage.href} className="min-w-0 overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10">
              <img src={stage.image} alt="" loading="lazy" className="h-24 w-full object-cover opacity-70" />
              <div className="min-w-0 p-4">
                <p className="font-mono text-xs" style={{ color: stage.accent }}>{stage.kicker}</p>
                <h2 className="font-display mt-2 text-lg font-semibold">{stage.title}</h2>
                <p className="mt-2 break-words text-sm leading-relaxed text-[#c8c3b8]">{stage.copy}</p>
                <p className="mt-3 text-sm underline underline-offset-4" style={{ color: stage.accent }}>Open stage →</p>
              </div>
            </Link>
          ))}
        </div>
      </details>
    </section>
  );
}
