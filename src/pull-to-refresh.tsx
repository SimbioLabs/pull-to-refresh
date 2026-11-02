import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { CrossfadeLabel } from "./crossfade-label";
import {
  isBlockedPullTarget,
  isEditableFocused,
} from "./gesture";
import {
  DEFAULT_DISABLED_AT,
  DEFAULT_LABELS,
  PULL_LABEL_FADE_MS,
  PULL_REDUCED_MOTION_MS,
  PULL_REFRESH_REST_PX,
  PULL_SETTLE_MS,
  phaseForPull,
  pullProgress,
  releaseSettleTarget,
  resistPull,
  triggerArmedHaptic,
} from "./math";
import { RefreshIndicator } from "./refresh-indicator";
import type {
  IndicatorPhase,
  PullIndicatorState,
  PullToRefreshLabels,
  PullToRefreshProps,
  RefreshHandler,
  ScrollContainerProps,
} from "./types";
import { useAnimatedOffset } from "./use-animated-offset";
import { usePullGesture } from "./use-pull-gesture";

const REDUCED_MOTION_MQ = "(prefers-reduced-motion: reduce)";

const useIsoLayout =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Controls = {
  setDisabled: (disabled: boolean) => void;
  registerRefresh: (handler: RefreshHandler) => () => void;
};

const PullToRefreshContext = createContext<Controls | null>(null);

function joinClass(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function assignRef<T>(ref: Ref<T> | null | undefined, node: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(node);
  else ref.current = node;
}

/**
 * Scroll-container pull-to-refresh.
 *
 * Put the top bar outside this element. Only `.pull-to-refresh-content`
 * translates, on animation frames. The indicator stays in a fixed slot.
 *
 * The gesture is touch-only. It does not listen to wheel or pointer, so a
 * trackpad scroll is never taken. Desktop widths disable it by default
 * (`disabledAt`).
 */
export const PullToRefresh = forwardRef<
  HTMLDivElement,
  PullToRefreshProps
>(function PullToRefresh(
  {
    children,
    onRefresh,
    disabled: disabledProp = false,
    className,
    style,
    threshold = 70,
    maxPull = 120,
    refreshingOffset = PULL_REFRESH_REST_PX,
    disabledAt = DEFAULT_DISABLED_AT,
    labels: labelsProp,
    renderIndicator,
    blockedSelector,
    haptic = true,
    scrollLabel = "Scrollable content",
    tabIndex = 0,
    id,
  },
  ref,
) {
  const [disabledLocal, setDisabledLocal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [spinStart, setSpinStart] = useState(270);

  const {
    offset: pullPx,
    offsetRef: pullPxRef,
    settling,
    setOffset: setPullPx,
    settleTo,
  } = useAnimatedOffset(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef(new Set<RefreshHandler>());
  const onRefreshRef = useRef(onRefresh);
  const disabledRef = useRef(false);
  const refreshingRef = useRef(false);
  const armedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const thresholdRef = useRef(threshold);
  const maxPullRef = useRef(maxPull);
  const refreshingOffsetRef = useRef(refreshingOffset);
  const hapticRef = useRef(haptic);
  const blockedSelectorRef = useRef(blockedSelector);
  const disabledAtRef = useRef(disabledAt);
  const breakpointRef = useRef<MediaQueryList | null>(null);

  const disabled = disabledProp || disabledLocal;

  useEffect(() => {
    onRefreshRef.current = onRefresh;
    refreshingRef.current = refreshing;
    reducedMotionRef.current = reducedMotion;
    thresholdRef.current = threshold;
    maxPullRef.current = maxPull;
    refreshingOffsetRef.current = refreshingOffset;
    hapticRef.current = haptic;
    blockedSelectorRef.current = blockedSelector;
    disabledAtRef.current = disabledAt;
    disabledRef.current = disabled;
  });

  const disableCountRef = useRef(0);
  const setDisabled = useCallback((next: boolean) => {
    disableCountRef.current += next ? 1 : -1;
    if (disableCountRef.current < 0) disableCountRef.current = 0;
    setDisabledLocal(disableCountRef.current > 0);
  }, []);

  const registerRefresh = useCallback((handler: RefreshHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const controls = useMemo<Controls>(
    () => ({ setDisabled, registerRefresh }),
    [registerRefresh, setDisabled],
  );

  const labels: PullToRefreshLabels = {
    pull: labelsProp?.pull ?? DEFAULT_LABELS.pull,
    release: labelsProp?.release ?? DEFAULT_LABELS.release,
    refreshing: labelsProp?.refreshing ?? DEFAULT_LABELS.refreshing,
  };

  const settlePullTo = useCallback(
    async (target: number) => {
      setDragging(false);
      const ms = reducedMotionRef.current
        ? PULL_REDUCED_MOTION_MS
        : PULL_SETTLE_MS;
      await settleTo(target, ms);
    },
    [settleTo],
  );

  const runRefreshWork = useCallback(async () => {
    const custom = onRefreshRef.current;
    if (custom) {
      try {
        await custom();
      } catch {
        /* a failed refresh must not leave the indicator open */
      }
    }
    const pageHandlers = [...handlersRef.current];
    await Promise.all(
      pageHandlers.map(async (handler) => {
        try {
          await handler();
        } catch {
          /* same as the prop handler */
        }
      }),
    );
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setCollapsing(false);
    setSpinStart(pullProgress(pullPxRef.current, thresholdRef.current) * 270);
    try {
      await settlePullTo(refreshingOffsetRef.current);
      await runRefreshWork();
      refreshingRef.current = false;
      setRefreshing(false);
      setCollapsing(true);
      await settlePullTo(0);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setCollapsing(false);
      setPullPx(0);
      setDragging(false);
      armedRef.current = false;
    }
  }, [pullPxRef, runRefreshWork, setPullPx, settlePullTo]);

  useIsoLayout(() => {
    const motion = window.matchMedia(REDUCED_MOTION_MQ);
    const syncMotion = () => setReducedMotion(motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);

    let breakpoint: MediaQueryList | null = null;
    const onBreakpoint = () => {
      if (!breakpoint?.matches || refreshingRef.current) return;
      setDragging(false);
      void settlePullTo(0);
      armedRef.current = false;
    };
    if (disabledAt !== false) {
      breakpoint = window.matchMedia(disabledAt);
      breakpointRef.current = breakpoint;
      breakpoint.addEventListener("change", onBreakpoint);
    } else {
      breakpointRef.current = null;
    }

    return () => {
      motion.removeEventListener("change", syncMotion);
      breakpoint?.removeEventListener("change", onBreakpoint);
    };
  }, [disabledAt, settlePullTo]);

  usePullGesture({
    targetRef: scrollRef,
    scrollerRef: scrollRef,
    enabled: () => {
      if (disabledRef.current || refreshingRef.current) return false;
      if (
        disabledAtRef.current !== false &&
        breakpointRef.current?.matches
      ) {
        return false;
      }
      if (isEditableFocused()) return false;
      return true;
    },
    resist: (dy) => resistPull(dy, maxPullRef.current),
    requireScrollTop: true,
    isBlockedTarget: (target) =>
      isBlockedPullTarget(
        target,
        scrollRef.current,
        blockedSelectorRef.current,
      ),
    onPullStart: () => {
      setDragging(true);
    },
    onPull: (px) => {
      setPullPx(px);
      const line = thresholdRef.current;
      if (px >= line && !armedRef.current) {
        armedRef.current = true;
        if (hapticRef.current && !reducedMotionRef.current) {
          triggerArmedHaptic();
        }
      } else if (px < line) {
        armedRef.current = false;
      }
    },
    onRelease: ({ pullPx: released }) => {
      setDragging(false);
      const { refresh } = releaseSettleTarget(
        released,
        thresholdRef.current,
        refreshingOffsetRef.current,
      );
      if (refresh && !disabledRef.current) {
        void runRefresh();
      } else if (!refreshingRef.current) {
        void settlePullTo(0).then(() => {
          armedRef.current = false;
        });
      }
    },
    onCancel: () => {
      setDragging(false);
      void settlePullTo(0);
      armedRef.current = false;
    },
  });

  const phase = phaseForPull(pullPx, refreshing, threshold);
  const progress = pullProgress(pullPx, threshold);
  const indicatorPhase: IndicatorPhase = collapsing
    ? "collapsing"
    : phase === "idle"
      ? "idle"
      : phase;

  const activeLabelId = collapsing
    ? null
    : phase === "refreshing"
      ? "refreshing"
      : phase === "armed"
        ? "release"
        : phase === "pulling"
          ? "pull"
          : null;

  const statusLabel =
    activeLabelId === "refreshing"
      ? labels.refreshing
      : activeLabelId === "release"
        ? labels.release
        : activeLabelId === "pull"
          ? labels.pull
          : undefined;

  const indicatorState: PullIndicatorState = {
    phase: indicatorPhase,
    progress,
    spinStartDeg: spinStart,
    reducedMotion,
    label: statusLabel,
    labels,
  };

  const setNode = (node: HTMLDivElement | null) => {
    scrollRef.current = node;
    assignRef(ref, node);
  };

  return (
    <PullToRefreshContext.Provider value={controls}>
      <div
        ref={setNode}
        id={id}
        className={joinClass("pull-to-refresh-root", className)}
        role="region"
        aria-label={scrollLabel}
        tabIndex={tabIndex}
        data-ptr-phase={collapsing ? "collapsing" : phase}
        data-ptr-progress={progress.toFixed(2)}
        data-ptr-dragging={dragging ? "true" : "false"}
        data-ptr-settling={settling ? "true" : "false"}
        style={
          {
            ...style,
            "--ptr-pull": `${pullPx}px`,
            "--ptr-progress": String(progress),
            "--ptr-settle-ms": `${reducedMotion ? PULL_REDUCED_MOTION_MS : PULL_SETTLE_MS}ms`,
            "--ptr-label-fade-ms": `${PULL_LABEL_FADE_MS}ms`,
            "--ptr-spin-start": `${spinStart}deg`,
          } as CSSProperties
        }
      >
        <RefreshIndicator
          phase={indicatorPhase}
          progress={progress}
          spinStartDeg={spinStart}
          reducedMotion={reducedMotion}
          custom={
            renderIndicator ? renderIndicator(indicatorState) : undefined
          }
          label={
            <CrossfadeLabel
              tone={phase === "armed" ? "armed" : "default"}
              fadeMs={reducedMotion ? 80 : PULL_LABEL_FADE_MS}
              activeId={activeLabelId}
              items={[
                { id: "pull", text: labels.pull },
                { id: "release", text: labels.release },
                { id: "refreshing", text: labels.refreshing },
              ]}
            />
          }
        />
        <div className="pull-to-refresh-content">{children}</div>
      </div>
    </PullToRefreshContext.Provider>
  );
});

/**
 * Plain scrollport, or `PullToRefresh` when `pullToRefresh` is set.
 * The plain mode does not attach a gesture.
 */
export const ScrollContainer = forwardRef<
  HTMLDivElement,
  ScrollContainerProps
>(function ScrollContainer(
  {
    children,
    className,
    style,
    id,
    tabIndex = 0,
    pullToRefresh = false,
    ...pullProps
  },
  ref,
) {
  if (!pullToRefresh) {
    return (
      <div
        ref={ref}
        id={id}
        style={style}
        className={joinClass("ptr-scroll", className)}
        tabIndex={tabIndex}
      >
        {children}
      </div>
    );
  }
  return (
    <PullToRefresh
      ref={ref}
      id={id}
      style={style}
      className={className}
      tabIndex={tabIndex}
      {...pullProps}
    >
      {children}
    </PullToRefresh>
  );
});

/** Reference-counted. Overlays call this so the page gesture stays idle. */
export function useDisablePullToRefresh(disabled: boolean) {
  const ctx = useContext(PullToRefreshContext);
  useEffect(() => {
    if (!ctx || !disabled) return;
    ctx.setDisabled(true);
    return () => ctx.setDisabled(false);
  }, [ctx, disabled]);
}

/**
 * Extra refresh work, usually from a page under the scroller.
 * No-op outside `PullToRefresh`. Handlers run after the `onRefresh` prop.
 */
export function useOnPullRefresh(handler: RefreshHandler) {
  const ctx = useContext(PullToRefreshContext);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!ctx) return;
    return ctx.registerRefresh(() => handlerRef.current());
  }, [ctx]);
}
