"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const LINKS = [
  { href: "/", label: "Command" },
  { href: "/forge", label: "Forge" },
  { href: "/rehearsal", label: "MiroFish" },
  { href: "/sentinel", label: "Jev Sentinel" },
  { href: "/verify", label: "Verify" },
  { href: "/personas", label: "Swarm" },
  { href: "/ledger", label: "Ledger" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#07080c]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/15 text-[#ff7a1a] ring-1 ring-orange-500/40">
            <ShieldAlert size={18} />
          </span>
          <span>
            <span className="font-display block text-[15px] font-semibold leading-none tracking-tight">
              SAAF Circuit Breaker
            </span>
            <span className="font-mono mt-1 block text-[10px] tracking-[0.18em] text-[#9aa3b2] uppercase">
              JET Care · Agents Gone Rogue
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-[#9aa3b2] hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="font-mono hidden rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] tracking-wider text-emerald-300 uppercase sm:inline">
            Zero LLM
          </span>
          <span className="font-mono rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] tracking-wider text-amber-200 uppercase">
            ISA 230
          </span>
        </div>
      </div>
    </header>
  );
}
