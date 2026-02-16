"use client";

type PixelCardProps = {
  children: React.ReactNode;
  selected?: boolean;
  sparkle?: boolean;
  onClick?: () => void;
  className?: string;
  as?: "div" | "button" | "li";
};

/**
 * Reusable panel/card with optional selected and sparkle (recommended) states.
 */
export function PixelCard({
  children,
  selected,
  sparkle,
  onClick,
  className = "",
  as: Component = "div",
}: PixelCardProps) {
  const classes = [
    "quest-card pixel-card snes-card",
    selected ? "selected" : "",
    sparkle ? "quest-card--gold-badge pixel-card--sparkle snes-card--sparkle" : "",
    onClick ? "cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const buttonProps =
    Component === "button"
      ? { type: "button" as const }
      : {};

  return (
    <Component
      className={classes}
      onClick={onClick}
      {...buttonProps}
      role={onClick && Component !== "button" ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="quest-card__parchment">{children}</div>
    </Component>
  );
}
