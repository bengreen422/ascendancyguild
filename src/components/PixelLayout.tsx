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
  { label: "Daily", href: "/daily" },
  { label: "Profile", href: "/profile" },
];

/**
 * RPG-style layout: app title "Ascendancy Guild", page title, nav links, centered frame.
 */
export function PixelLayout({
  title,
  navLinks = DEFAULT_NAV,
  children,
}: PixelLayoutProps) {
  return (
    <main className="max-w-lg mx-auto px-4 py-6 pixel-theme-bg min-h-screen">
      <header className="pixel-frame pixel-panel flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="pixel-title text-lg tracking-wide">Ascendancy Guild</h1>
          <span className="pixel-subtitle text-sm">— {title}</span>
        </div>
        <nav className="flex gap-2">
          {navLinks.map(({ label, href }) => (
            <PixelButton key={href} href={href} variant="secondary">
              {label}
            </PixelButton>
          ))}
        </nav>
      </header>
      <div className="pixel-frame pixel-panel p-4 md:p-6">{children}</div>
    </main>
  );
}
