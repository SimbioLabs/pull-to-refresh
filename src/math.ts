/** Pull distance that arms a refresh. */
export const PULL_THRESHOLD_PX = 70;
/** Rubber-band cap. */
export const PULL_MAX_PX = 120;
/**
 * Content offset held while refresh work runs.
 * Tall enough for the default ring and label (0.75 + 2.35 + 0.35 + 1.05 rem)
 * so they sit in the opened gap, under an overlaying bar, instead of on the
 * first line. Pass `refreshingOffset` to use a shorter rest.
 */
export const PULL_REFRESH_REST_PX = 76;
/** Opacity crossfade between labels. Typography does not change. */
export const PULL_LABEL_FADE_MS = 150;
/** Shared settle duration. Frame-by-frame; not a CSS transition. */
export const PULL_SETTLE_MS = 300;
/** Settle duration when `prefers-reduced-motion: reduce` matches. */
export const PULL_REDUCED_MOTION_MS = 120;
/** cubic-bezier(0.22, 1, 0.36, 1) */
export const PULL_EASE = [0.22, 1, 0.36, 1] as const;

export const DEFAULT_DISABLED_AT = "(min-width: 1024px)";

export const DEFAULT_LABELS = {
  pull: "Pull to refresh",
  release: "Release to refresh",
  refreshing: "Refreshing",
} as const;

export const PULL_HAPTIC_MS = 12;

/**
 * Rubber-band: grows slower as `dy` increases and never passes `max`.
 * `dy` is raw finger travel downward, in px.
 */
export function resistPull(dy: number, max = PULL_MAX_PX): number {
  if (dy <= 0 || max <= 0) return 0;
  const resisted = (dy * max) / (dy + max * 0.65);
  return Math.min(max, resisted);
}

/** 0..1 against the arming threshold. */
export function pullProgress(
  pullPx: number,
  threshold = PULL_THRESHOLD_PX,
): number {
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(1, pullPx / threshold));
}

export type PullPhaseName = "idle" | "pulling" | "armed" | "refreshing";

export function phaseForPull(
  pullPx: number,
  refreshing: boolean,
  threshold = PULL_THRESHOLD_PX,
): PullPhaseName {
  if (refreshing) return "refreshing";
  if (pullPx <= 0) return "idle";
  if (pullPx >= threshold) return "armed";
  return "pulling";
}

/** Where the offset should rest after the finger lifts. */
export function releaseSettleTarget(
  pullPx: number,
  threshold = PULL_THRESHOLD_PX,
  restPx = PULL_REFRESH_REST_PX,
): { refresh: boolean; target: number } {
  if (pullPx >= threshold) return { refresh: true, target: restPx };
  return { refresh: false, target: 0 };
}

/** One short pulse when the gesture crosses the threshold. */
export function triggerArmedHaptic(
  nav: { vibrate?: (pattern: number | number[]) => boolean } | null =
    typeof navigator !== "undefined" ? navigator : null,
): void {
  try {
    nav?.vibrate?.(PULL_HAPTIC_MS);
  } catch {
    /* unsupported or blocked */
  }
}
