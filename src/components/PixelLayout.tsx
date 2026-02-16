"use client";

import Link from "next/link";
import { PixelButton } from "./PixelButton";

type PixelLayoutProps = {
  /** Page title (e.g. "Quest Scroll", "Character Sheet") */
  title: string;
  /** Right-side nav: e.g. [{ label: "Profile", href: "/profile" }] */
  navLinks?: Array<{ label: string; href: string }>;
  children: React.ReactNode;
};

const DEFAULT_NAV = [
  { label: "Instructions", href: "/instructions" },
  { label: "Daily", href: "/daily" },
  { label: "Profile", href: "/profile" },
];

/**
 * RPG-style layout: header (carved wood), primary frame container, parchment content.
 */
export function PixelLayout({
  title,
  navLinks = DEFAULT_NAV,
  children,
}: PixelLayoutProps) {
  return (
    <main className="max-w-lg mx-auto px-4 py-6 pixel-theme-bg wood-bg min-h-screen">
      <header className="wood-frame-header flex flex-wrap justify-between items-center gap-3 mb-6 py-4 px-4 md:px-5">
        <div className="flex items-baseline gap-3 flex-1 min-w-0 justify-center md:justify-start">
          <h1 className="pixel-title wood-title text-xl md:text-2xl tracking-wide text-center md:text-left">
            Ascendancy Guild
          </h1>
          <span className="pixel-subtitle text-sm whitespace-nowrap hidden sm:inline">— {title}</span>
        </div>
        <nav className="flex gap-2 flex-shrink-0">
          {navLinks.map(({ label, href }) => (
            <PixelButton key={href} href={href} variant="secondary" className="wood-button">
              {label}
            </PixelButton>
          ))}
        </nav>
      </header>
      <div className="wood-frame-primary p-4 md:p-6">
        <div className="parchment-panel min-h-[200px]">{children}</div>
      </div>
    </main>
  );
}
