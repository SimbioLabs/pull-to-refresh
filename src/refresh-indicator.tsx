import type { CSSProperties, ReactNode } from "react";
import type { IndicatorPhase } from "./types";

/**
 * Fixed slot for the pull indicator.
 * The slot is centered with a constant `translateX(-50%)`. It does not
 * scale, and it does not follow the pull. Opacity is the only motion
 * on the slot. The ring rotates inside it.
 */
export function RefreshIndicator({
  phase,
  progress = 0,
  spinStartDeg = 270,
  reducedMotion = false,
  label,
  className,
  style,
  custom,
}: {
  phase: IndicatorPhase;
  progress?: number;
  spinStartDeg?: number;
  reducedMotion?: boolean;
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Replaces the ring and label. `undefined` keeps the default. */
  custom?: ReactNode;
}) {
  const visible =
    phase === "pulling" ||
    phase === "armed" ||
    phase === "refreshing" ||
    phase === "collapsing";
  const spinning = phase === "refreshing" && !reducedMotion;
  const rotation = ringRotation(phase, progress, reducedMotion, spinStartDeg);

  return (
    <div
      className={[
        "pull-to-refresh-indicator",
        visible ? "is-visible" : "",
        phase === "armed" ? "is-armed" : "",
        spinning ? "is-spinning" : "",
        phase === "collapsing" ? "is-collapsing" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="pull-to-refresh"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={phase === "refreshing" || undefined}
      aria-hidden={visible ? undefined : true}
      style={style}
    >
      {custom !== undefined ? (
        custom
      ) : (
        <>
          <span
            className="pull-to-refresh-ring"
            style={
              rotation == null
                ? ({
                    ["--ptr-spin-start" as string]: `${spinStartDeg}deg`,
                  } as CSSProperties)
                : { transform: `rotate(${rotation}deg)` }
            }
          />
          {label}
        </>
      )}
    </div>
  );
}

function ringRotation(
  phase: IndicatorPhase,
  progress: number,
  reducedMotion: boolean,
  spinStartDeg: number,
): number | undefined {
  if (phase === "refreshing" && !reducedMotion) return undefined;
  if (phase === "collapsing") return reducedMotion ? 180 : spinStartDeg;
  if (reducedMotion) {
    if (phase === "armed") return 180;
    return progress * 180;
  }
  return progress * 270;
}
