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
    "pixel-card",
    selected ? "selected" : "",
    sparkle ? "pixel-card--sparkle" : "",
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
      {children}
    </Component>
  );
}
