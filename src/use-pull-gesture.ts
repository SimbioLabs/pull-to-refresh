import { useEffect, useRef, type RefObject } from "react";
import {
  bindVerticalPullGesture,
  type BindVerticalPullOptions,
} from "./gesture";

export type UsePullGestureOptions = Omit<
  BindVerticalPullOptions,
  "target" | "scroller" | "requireScrollTop"
> & {
  targetRef: RefObject<HTMLElement | null>;
  scrollerRef?: RefObject<HTMLElement | null>;
  requireScrollTop?: boolean;
};

/**
 * Native vertical pull. `touchmove` is registered with `{ passive: false }`.
 * Callbacks are read on each event. The listener attaches once per element.
 */
export function usePullGesture({
  targetRef,
  scrollerRef,
  ...bindOpts
}: UsePullGestureOptions) {
  const optsRef = useRef(bindOpts);
  useEffect(() => {
    optsRef.current = bindOpts;
  });

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    const scroller = scrollerRef?.current ?? target;
    return bindVerticalPullGesture({
      target,
      scroller,
      enabled: () => optsRef.current.enabled?.() ?? true,
      resist: (dy) => optsRef.current.resist?.(dy) ?? Math.max(0, dy),
      requireScrollTop: () => optsRef.current.requireScrollTop !== false,
      onPullStart: () => optsRef.current.onPullStart?.(),
      onPull: (px, raw) => optsRef.current.onPull(px, raw),
      onRelease: (info) => optsRef.current.onRelease(info),
      onCancel: () => optsRef.current.onCancel?.(),
      isBlockedTarget: (targetNode) =>
        optsRef.current.isBlockedTarget?.(targetNode) ?? false,
    });
  }, [scrollerRef, targetRef]);
}
