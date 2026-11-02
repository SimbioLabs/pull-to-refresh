import { PULL_EASE, PULL_SETTLE_MS } from "./math";

/** Y value of cubic-bezier(x1, y1, x2, y2) at linear time `t` in [0, 1]. */
export function cubicBezierEase(
  t: number,
  x1 = PULL_EASE[0],
  y1 = PULL_EASE[1],
  x2 = PULL_EASE[2],
  y2 = PULL_EASE[3],
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let u = t;
  for (let i = 0; i < 6; i += 1) {
    const x =
      3 * (1 - u) * (1 - u) * u * x1 +
      3 * (1 - u) * u * u * x2 +
      u * u * u;
    const dx =
      3 * (1 - u) * (1 - u) * x1 +
      6 * (1 - u) * u * (x2 - x1) +
      3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u -= (x - t) / dx;
    u = Math.max(0, Math.min(1, u));
  }
  return (
    3 * (1 - u) * (1 - u) * u * y1 +
    3 * (1 - u) * u * u * y2 +
    u * u * u
  );
}

export type AnimateOffsetOptions = {
  durationMs?: number;
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  ease?: (t: number) => number;
  /** Stop scheduling frames. Does not snap to the target. */
  isCancelled?: () => boolean;
};

/**
 * Move an offset on animation frames.
 * Do not also CSS-transition a transform that reads the value: WebKit
 * snaps that transition to the end.
 */
export function animateOffset(
  from: number,
  to: number,
  apply: (px: number) => void,
  opts: AnimateOffsetOptions = {},
): Promise<void> {
  const durationMs = opts.durationMs ?? PULL_SETTLE_MS;
  const now = opts.now ?? (() => performance.now());
  const raf = opts.raf ?? requestAnimationFrame;
  const ease = opts.ease ?? ((t: number) => cubicBezierEase(t));
  if (opts.isCancelled?.()) return Promise.resolve();
  if (durationMs <= 0 || Math.abs(to - from) < 0.5) {
    apply(to);
    return Promise.resolve();
  }
  const start = now();
  return new Promise((resolve) => {
    const tick = (frameTime: number) => {
      if (opts.isCancelled?.()) {
        resolve();
        return;
      }
      const t = Math.min(1, (frameTime - start) / durationMs);
      apply(from + (to - from) * ease(t));
      if (t < 1) raf(tick);
      else {
        apply(to);
        resolve();
      }
    };
    raf(tick);
  });
}
