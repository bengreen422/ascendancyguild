"use client";

import Link from "next/link";

type PixelButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
};

/**
 * Primary (teal) or secondary (parchment) button. Use href for links.
 */
export function PixelButton({
  children,
  variant = "secondary",
  type = "button",
  disabled,
  onClick,
  href,
  className = "",
}: PixelButtonProps) {
  const baseClass = "wood-button pixel-button snes-button";
  const variantClass = variant === "primary" ? "wood-button--primary pixel-button--primary snes-button--primary" : "";
  const classes = [baseClass, variantClass, className].filter(Boolean).join(" ");

  if (href) {
    return (
      <Link href={href} className={`${classes} no-underline text-inherit`}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}
