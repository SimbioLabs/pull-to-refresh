import type { CSSProperties } from "react";

export type CrossfadeLabelItem = {
  id: string;
  text: string;
};

/**
 * Fixed-height label stack. Swapping the active id fades opacity only.
 * Font, size, weight, and tracking stay on the parent and do not change.
 */
export function CrossfadeLabel({
  items,
  activeId,
  tone = "default",
  className,
  style,
  fadeMs = 150,
}: {
  items: CrossfadeLabelItem[];
  activeId: string | null;
  tone?: "default" | "armed";
  className?: string;
  style?: CSSProperties;
  fadeMs?: number;
}) {
  return (
    <span
      className={["pull-to-refresh-copy", className].filter(Boolean).join(" ")}
      data-tone={tone}
      style={
        {
          "--ptr-label-fade-ms": `${fadeMs}ms`,
          ...style,
        } as CSSProperties
      }
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <span
            key={item.id}
            className={active ? "is-active" : undefined}
            aria-hidden={!active}
          >
            {item.text}
          </span>
        );
      })}
    </span>
  );
}
