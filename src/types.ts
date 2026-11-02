import type { CSSProperties, ReactNode } from "react";

/** Idle, finger down, past the threshold, or waiting on `onRefresh`. */
export type PullPhase = "idle" | "pulling" | "armed" | "refreshing";

/** Visual phase. `collapsing` is the opacity fade after refresh, before idle. */
export type IndicatorPhase = PullPhase | "collapsing";

export type RefreshHandler = () => void | Promise<void>;

export type PullToRefreshLabels = {
  pull: string;
  release: string;
  refreshing: string;
};

export type PullIndicatorState = {
  phase: IndicatorPhase;
  /** 0..1, clamped at the threshold. */
  progress: number;
  /** Degrees the ring had reached when refresh started. Spin continues from here. */
  spinStartDeg: number;
  reducedMotion: boolean;
  /** Label for the current phase, if any. */
  label: string | undefined;
  labels: PullToRefreshLabels;
};

export type PullToRefreshProps = {
  children: ReactNode;
  /**
   * Runs after an armed release, once the content has settled to
   * `refreshingOffset`. Rejected promises are caught so the indicator
   * can close. Page-level `useOnPullRefresh` handlers run after this.
   */
  onRefresh?: RefreshHandler;
  /** Ignore the gesture. Stacks with `useDisablePullToRefresh`. */
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Distance in px that arms a refresh. Default 70. */
  threshold?: number;
  /** Rubber-band cap in px. Default 120. */
  maxPull?: number;
  /** Content offset held while `onRefresh` runs. Default 76. */
  refreshingOffset?: number;
  /**
   * Media query that disables the gesture.
   * Default `(min-width: 1024px)`. Pass `false` to keep it at every width.
   */
  disabledAt?: string | false;
  labels?: Partial<PullToRefreshLabels>;
  /**
   * Replace the ring and the label. The slot stays fixed: same position,
   * same opacity fade. Do not scale this content with the pull distance.
   */
  renderIndicator?: (state: PullIndicatorState) => ReactNode;
  /**
   * Extra `Element.closest` selector. Matches never start a pull.
   * Inputs, textareas, selects, contenteditable, and `[data-no-ptr]` are
   * always blocked.
   */
  blockedSelector?: string;
  /** 12ms vibration when the pull crosses the threshold. Default true. */
  haptic?: boolean;
  /**
   * Accessible name for the scroll region. Default "Scrollable content".
   * Pass a translated string.
   */
  scrollLabel?: string;
  tabIndex?: number;
  /** Forwarded to the scroll element. */
  id?: string;
};

export type ScrollContainerProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  tabIndex?: number;
  /**
   * When false, renders a plain scrollport (`ptr-scroll`) and ignores
   * pull props. Default false.
   */
  pullToRefresh?: boolean;
} & Partial<Omit<PullToRefreshProps, "children" | "className" | "style" | "id" | "tabIndex">>;
