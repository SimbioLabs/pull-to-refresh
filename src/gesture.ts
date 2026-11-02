/**
 * Vertical pull on a scroll container.
 *
 * The listener on `touchmove` is `{ passive: false }` so `preventDefault`
 * can beat a rubber-band. At the top, the first downward move is claimed
 * immediately: WebKit starts a rubber-band on the first uncancelled
 * `touchmove` and then ignores later cancellation.
 *
 * Horizontal pans and content that is already scrolled are left to the
 * browser. A fast flick below the threshold does not count as a refresh;
 * only the resisted distance does.
 */

export const PULL_DIRECTION_LOCK_PX = 8;
export const PULL_HORIZONTAL_LOCK_RATIO = 1.15;
/** Sub-pixel and 1px drift still count as the top. */
export const PULL_SCROLL_TOP_SLOP_PX = 1;

export type PullDirectionMode = "pull" | "scroll" | null;

export function scrollTopAllowsPull(
  el: HTMLElement | null | undefined,
  slop = PULL_SCROLL_TOP_SLOP_PX,
): boolean {
  if (!el) return true;
  return el.scrollTop <= slop;
}

/**
 * True when this move should be cancelled so the browser does not
 * rubber-band. Downward at the top, before the direction lock.
 * Horizontal pans and an already-locked scroll gesture stay native.
 */
export function shouldClaimPullTouchMove(
  dx: number,
  dy: number,
  atScrollTop: boolean,
  mode: PullDirectionMode,
): boolean {
  if (mode === "scroll") return false;
  if (!atScrollTop) return false;
  if (dy <= 0) return false;
  return dy >= Math.abs(dx);
}

/** Clearly downward, past the lock distance. */
export function isVerticalDownPull(
  dx: number,
  dy: number,
  armPx = PULL_DIRECTION_LOCK_PX,
  lockRatio = PULL_HORIZONTAL_LOCK_RATIO,
): boolean {
  if (dy < armPx) return false;
  return dy > Math.abs(dx) * lockRatio;
}

/**
 * Lock after a few pixels. `"pull"` is downward at the top.
 * Anything else that has traveled far enough is `"scroll"`.
 */
export function lockPullDirection(args: {
  dx: number;
  dy: number;
  atScrollTop: boolean;
  armPx?: number;
}): PullDirectionMode {
  const arm = args.armPx ?? PULL_DIRECTION_LOCK_PX;
  if (Math.abs(args.dx) < arm && Math.abs(args.dy) < arm) return null;
  if (args.atScrollTop && isVerticalDownPull(args.dx, args.dy, arm)) {
    return "pull";
  }
  return "scroll";
}

const NATIVE_BLOCKED =
  "[data-no-ptr], input, textarea, select, [contenteditable='true']";

function canScrollItself(el: HTMLElement): boolean {
  const oy = getComputedStyle(el).overflowY;
  if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + 1;
}

/** A scrollable ancestor between the touch and the pull scroller. */
export function isInsideNestedScroller(
  target: EventTarget | null,
  scroller: HTMLElement | null,
): boolean {
  if (!(target instanceof Element) || !scroller) return false;
  let el: Element | null = target;
  while (el && el !== scroller) {
    if (el instanceof HTMLElement && canScrollItself(el)) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Inputs, `[data-no-ptr]`, an optional extra selector, and nested
 * scrollports. The pull scroller itself is not treated as nested.
 */
export function isBlockedPullTarget(
  target: EventTarget | null,
  scroller: HTMLElement | null,
  extraSelector?: string,
): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(NATIVE_BLOCKED)) return true;
  if (extraSelector && target.closest(extraSelector)) return true;
  return isInsideNestedScroller(target, scroller);
}

export function isEditableFocused(doc: Document = document): boolean {
  const el = doc.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(el.isContentEditable);
}

export type PullReleaseInfo = {
  pullPx: number;
  rawDy: number;
  /** px per ms, last sample. Informational. Refresh does not use it. */
  velocity: number;
};

export type BindVerticalPullOptions = {
  target: HTMLElement;
  scroller?: HTMLElement;
  enabled?: () => boolean;
  resist?: (dy: number) => number;
  onPullStart?: () => void;
  onPull: (px: number, rawDy: number) => void;
  onRelease: (info: PullReleaseInfo) => void;
  onCancel?: () => void;
  /**
   * When true (the default), a pull only starts at the top.
   * A function is read on each event so React callers can change it.
   */
  requireScrollTop?: boolean | (() => boolean);
  isBlockedTarget?: (target: EventTarget | null) => boolean;
};

function scrollTopRequired(
  flag: BindVerticalPullOptions["requireScrollTop"],
): boolean {
  if (typeof flag === "function") return flag();
  if (flag === undefined) return true;
  return flag;
}

/**
 * Attach the pull listeners. `touchmove` is non-passive and captured.
 * Returns a disposer.
 */
export function bindVerticalPullGesture(
  options: BindVerticalPullOptions,
): () => void {
  const {
    target,
    scroller = target,
    enabled = () => true,
    resist = (dy) => Math.max(0, dy),
    onPullStart,
    onPull,
    onRelease,
    onCancel,
    isBlockedTarget,
  } = options;

  type Gesture = {
    id: number;
    startX: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    mode: PullDirectionMode;
    pulling: boolean;
    lastPull: number;
    lastRaw: number;
  };
  let gesture: Gesture | null = null;

  const drop = (notify: boolean) => {
    const wasPulling = gesture?.pulling ?? false;
    gesture = null;
    if (notify && wasPulling) onCancel?.();
  };

  const onTouchStart = (event: TouchEvent) => {
    if (!enabled()) return;
    if (event.touches.length !== 1) {
      drop(true);
      return;
    }
    if (
      scrollTopRequired(options.requireScrollTop) &&
      !scrollTopAllowsPull(scroller)
    ) {
      return;
    }
    if (isBlockedTarget?.(event.target)) return;
    const touch = event.touches[0];
    if (!touch) return;
    const now = performance.now();
    gesture = {
      id: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastY: touch.clientY,
      lastTime: now,
      velocity: 0,
      mode: null,
      pulling: false,
      lastPull: 0,
      lastRaw: 0,
    };
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!gesture) return;
    if (!enabled()) {
      drop(true);
      return;
    }
    let touch: Touch | undefined;
    for (let i = 0; i < event.touches.length; i += 1) {
      const candidate = event.touches.item(i);
      if (candidate && candidate.identifier === gesture.id) {
        touch = candidate;
        break;
      }
    }
    if (!touch) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;
    const now = performance.now();
    const dt = Math.max(1, now - gesture.lastTime);
    gesture.velocity = (touch.clientY - gesture.lastY) / dt;
    gesture.lastY = touch.clientY;
    gesture.lastTime = now;

    const requireTop = scrollTopRequired(options.requireScrollTop);
    const atTop = scrollTopAllowsPull(scroller);
    if (
      requireTop &&
      shouldClaimPullTouchMove(dx, dy, atTop, gesture.mode) &&
      event.cancelable
    ) {
      event.preventDefault();
    }

    if (
      gesture.mode === null &&
      requireTop &&
      shouldClaimPullTouchMove(dx, dy, atTop, null)
    ) {
      gesture.mode = "pull";
    }

    if (gesture.mode === null) {
      gesture.mode = lockPullDirection({ dx, dy, atScrollTop: atTop });
      if (gesture.mode === null) return;
    }

    if (gesture.mode === "scroll") return;

    if (requireTop && !atTop) {
      if (gesture.pulling) {
        // A late scroll bump while we already own the pull would snap
        // the offset back. Pin the scroller instead of releasing.
        if (scroller.scrollTop > 0) scroller.scrollTop = 0;
      } else {
        gesture.mode = "scroll";
        gesture.pulling = false;
        gesture.lastPull = 0;
        onPull(0, 0);
        return;
      }
    }

    if (dy <= 0) {
      gesture.lastPull = 0;
      gesture.lastRaw = 0;
      onPull(0, 0);
      return;
    }

    if (!gesture.pulling) {
      gesture.pulling = true;
      onPullStart?.();
    }

    const pull = resist(dy);
    gesture.lastPull = pull;
    gesture.lastRaw = dy;
    onPull(pull, dy);
    if (event.cancelable) event.preventDefault();
  };

  const onTouchEnd = () => {
    if (!gesture) return;
    const info: PullReleaseInfo = {
      pullPx: gesture.lastPull,
      rawDy: gesture.lastRaw,
      velocity: gesture.velocity,
    };
    const wasPulling = gesture.pulling;
    gesture = null;
    if (!wasPulling) return;
    onRelease(info);
  };

  const onTouchCancel = () => {
    drop(true);
  };

  const moveOpts: AddEventListenerOptions = { passive: false, capture: true };
  const bubbleOpts: AddEventListenerOptions = { passive: true, capture: true };

  target.addEventListener("touchstart", onTouchStart, bubbleOpts);
  target.addEventListener("touchmove", onTouchMove, moveOpts);
  target.addEventListener("touchend", onTouchEnd, bubbleOpts);
  target.addEventListener("touchcancel", onTouchCancel, bubbleOpts);

  return () => {
    target.removeEventListener("touchstart", onTouchStart, true);
    target.removeEventListener("touchmove", onTouchMove, true);
    target.removeEventListener("touchend", onTouchEnd, true);
    target.removeEventListener("touchcancel", onTouchCancel, true);
    gesture = null;
  };
}
