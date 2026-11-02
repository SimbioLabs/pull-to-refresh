import { useCallback, useEffect, useRef, useState } from "react";
import { animateOffset } from "./easing";
import { PULL_SETTLE_MS } from "./math";

export type AnimatedOffset = {
  offset: number;
  offsetRef: { current: number };
  settling: boolean;
  setOffset: (px: number) => void;
  settleTo: (target: number, durationMs?: number) => Promise<void>;
};

/**
 * Drag writes the offset immediately. Release lerps it on animation frames.
 * A new drag or a new settle cancels the in-flight lerp so the two do not fight.
 */
export function useAnimatedOffset(initial = 0): AnimatedOffset {
  const [offset, setOffsetState] = useState(initial);
  const [settling, setSettling] = useState(false);
  const offsetRef = useRef(initial);
  const gen = useRef(0);

  const setOffset = useCallback((px: number) => {
    gen.current += 1;
    offsetRef.current = px;
    setOffsetState(px);
    setSettling(false);
  }, []);

  const settleTo = useCallback(
    async (target: number, durationMs = PULL_SETTLE_MS) => {
      const token = ++gen.current;
      const from = offsetRef.current;
      if (Math.abs(target - from) < 0.5) {
        offsetRef.current = target;
        setOffsetState(target);
        setSettling(false);
        return;
      }
      setSettling(true);
      await animateOffset(
        from,
        target,
        (px) => {
          if (gen.current !== token) return;
          offsetRef.current = px;
          setOffsetState(px);
        },
        {
          durationMs,
          isCancelled: () => gen.current !== token,
        },
      );
      if (gen.current !== token) return;
      setSettling(false);
    },
    [],
  );

  useEffect(() => {
    return () => {
      gen.current += 1;
    };
  }, []);

  return { offset, offsetRef, settling, setOffset, settleTo };
}
