import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAAF Circuit Breaker — Agents Gone Rogue",
  description:
    "Containment pipeline for JET Customer Care refunds. SAAF-Forge, MiroFish rehearsal, Jev Sentinel, ISA 230 verify. Hard rules outside the model.",
  openGraph: {
    title: "SAAF Circuit Breaker",
    description: "A refunds agent that talks itself out of its own policy — and the circuit breaker that catches it.",
    images: ["/images/og-cover.svg"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="relative z-10">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}

