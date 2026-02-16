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
  { label: "GM", href: "/gm" },
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
      <header className="wood-frame-header flex flex-col items-center gap-4 mb-6 py-4 px-4 md:px-5">
        <div className="flex flex-col items-center gap-1 w-full">
          <h1 className="header-app-title pixel-title wood-title text-xl md:text-2xl tracking-wide text-center">
            Ascendancy Guild
          </h1>
          <span className="header-subtitle pixel-subtitle text-sm text-center">— {title}</span>
        </div>
        <nav className="flex flex-wrap gap-2 justify-center">
          {navLinks.map(({ label, href }) => (
            <PixelButton key={href} href={href} variant="secondary" className="wood-button wood-button--nav">
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
