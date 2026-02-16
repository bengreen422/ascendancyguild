"use client";

import Link from "next/link";

type PixelLayoutProps = {
  title: string;
  /** Right-side link label (e.g. "View Profile") */
  navLabel: string;
  /** Right-side link href (e.g. "/profile") */
  navHref: string;
  children: React.ReactNode;
};

/**
 * Reusable RPG-style frame: top panel (title + nav link) and content area.
 * Theme layer only – remove component usage to revert.
 */
export function PixelLayout({ title, navLabel, navHref, children }: PixelLayoutProps) {
  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <header className="pixel-panel pixel-border flex justify-between items-center mb-6">
        <h1 className="pixel-title text-xl">{title}</h1>
        <Link
          href={navHref}
          className="pixel-button no-underline text-inherit"
        >
          {navLabel}
        </Link>
      </header>
      <div className="pixel-theme-content">{children}</div>
    </main>
  );
}
