import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Outfit, Syne } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const ui = Outfit({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["300", "400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

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
      <body className={`${display.variable} ${ui.variable} ${mono.variable} antialiased`}>
        <div className="relative z-10">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
