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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07080c]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-3">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/15 text-[#ff7a1a] ring-1 ring-orange-500/40">
            <ShieldAlert size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="font-display block text-[15px] font-semibold leading-none tracking-tight">
              SAAF Circuit Breaker
            </span>
            <span className="mt-1 block text-xs text-[#9aa3b2]">
              Refund safety · working prototype
            </span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex w-full flex-wrap items-center gap-1 lg:w-auto">
          {LINKS.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-sm transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-[#b6bfcc] hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
