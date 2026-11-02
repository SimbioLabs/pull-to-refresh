# @simbiolabs/pull-to-refresh

Scroll-container pull-to-refresh for React.

The top bar stays where it is. Only the scroll container's content moves. Releasing the gesture eases back frame by frame, so the content does not jump. The indicator keeps one font size, one gap, and one position for the whole animation, and it stays horizontally centered.

The gesture is touch-only. A normal scroll is not swallowed. Wheel and trackpad input are ignored.

```bash
npm install @simbiolabs/pull-to-refresh
```

React 18 or 19 is a peer dependency. There are no runtime dependencies.

```tsx
import { PullToRefresh } from "@simbiolabs/pull-to-refresh";
import "@simbiolabs/pull-to-refresh/styles.css";

export function Inbox({ onReload, children }) {
  return (
    <div className="ptr-shell">
      <header className="app-bar">Inbox</header>
      <PullToRefresh onRefresh={onReload}>{children}</PullToRefresh>
    </div>
  );
}
```

`onRefresh` may return a promise. The indicator stays open until it settles. A rejected promise is caught so the indicator can close.

Import the stylesheet once, at the root of the app. The package does not inject CSS.

## Keep the bar outside the scroller

`PullToRefresh` is not a window-level pull. It is the scrollport.

```text
.ptr-shell                     100dvh, overflow hidden, column
  header                       fixed, or in normal flow above the scroller
  .pull-to-refresh-root        the scrollport
    .pull-to-refresh-indicator fixed slot, centered, opacity only
    .pull-to-refresh-content   the only element that translates
```

`position: fixed` inside `.pull-to-refresh-content` is trapped by the content's transform. Bars, menus, and toasts belong outside `PullToRefresh`, or portaled to `document.body`.

Two layouts:

**The bar overlays the scroller.** The header is `position: fixed`. Pad the content by the bar's block size, including the top safe area, and set the same value on `--ptr-header-offset` so the indicator sits under the bar.

```css
.app-bar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  height: calc(4rem + env(safe-area-inset-top, 0px));
}

.pull-to-refresh-root {
  --ptr-header-offset: calc(4rem + env(safe-area-inset-top, 0px));
}

.page {
  padding-top: calc(4rem + env(safe-area-inset-top, 0px));
  padding-bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px));
}
```

**The bar is already above the scroller.** A side rail is a sibling of `PullToRefresh`, not a child of the translated content. Leave `--ptr-header-offset` at `0`. The indicator then sits `0.75rem` from the top of the scrollport.

```tsx
<div className="ptr-shell">
  <header className="app-bar">Records</header>
  <div className="ptr-shell-fill">
    <nav className="rail">…</nav>
    <PullToRefresh onRefresh={reload}>{children}</PullToRefresh>
  </div>
</div>
```

Size that shell with the included `.ptr-shell` class (`100dvh`). Do not use `100lvh`. See [WebKit](#webkit).

## Page handlers

`onRefresh` is the shell. A page under it can register more work. Handlers run after `onRefresh`, together. Outside the provider, the hook does nothing.

```tsx
import { useOnPullRefresh } from "@simbiolabs/pull-to-refresh";

export function MessageList() {
  useOnPullRefresh(() => reloadMessages());
  return <ul>{/* … */}</ul>;
}
```

An open sheet should disable the page gesture. The disable is reference-counted, so two overlays can overlap.

```tsx
import { useDisablePullToRefresh } from "@simbiolabs/pull-to-refresh";

export function Sheet({ open }) {
  useDisablePullToRefresh(open);
  return open ? <div data-no-ptr>{/* … */}</div> : null;
}
```

`data-no-ptr` on a region also blocks the gesture from starting there. Inputs, textareas, selects, and `contenteditable` are blocked. A nested element that scrolls on its own is left to the browser.

Pass `blockedSelector` for another `Element.closest` selector.

## Desktop

The gesture is off at `(min-width: 1024px)` by default. Pass another query, or `false` to keep it at every width.

```tsx
<PullToRefresh disabledAt={false} onRefresh={reload}>
  {children}
</PullToRefresh>
```

`disabled` turns it off regardless of width.

## Labels, threshold, indicator

```tsx
<PullToRefresh
  threshold={70}
  maxPull={120}
  refreshingOffset={76}
  labels={{
    pull: "Puxe para atualizar",
    release: "Solte para atualizar",
    refreshing: "Atualizando",
  }}
  renderIndicator={(state) => (
    <span>
      {state.label} {Math.round(state.progress * 100)}
    </span>
  )}
  onRefresh={reload}
>
  {children}
</PullToRefresh>
```

| Prop | Default | |
| --- | --- | --- |
| `onRefresh` | | `() => void \| Promise<void>` |
| `threshold` | `70` | Armed distance, px |
| `maxPull` | `120` | Rubber-band cap, px |
| `refreshingOffset` | `76` | Offset held while `onRefresh` runs |
| `disabledAt` | `(min-width: 1024px)` | `false` keeps the gesture |
| `labels` | English pull / release / refreshing | Partial |
| `renderIndicator` | Ring and crossfade label | Do not scale it with the pull |
| `haptic` | `true` | 12ms vibration at the threshold. Off under reduced motion |
| `blockedSelector` | | Extra `closest` selector |
| `scrollLabel` | `Scrollable content` | Accessible name of the region |
| `disabled` | `false` | |

The pull grows slower as the finger travels and never passes `maxPull`. A fast flick that stays under `threshold` does not refresh. Only the resisted distance does.

`refreshingOffset` defaults to 76px so the stock ring and label fit in the gap under the bar. A shorter rest, such as 48, tucks the content back up and the label can sit on the first line unless that line has its own top padding.

`ScrollContainer` is the same element with the gesture off, until `pullToRefresh` is set.

```tsx
<ScrollContainer pullToRefresh onRefresh={reload}>
  {children}
</ScrollContainer>
```

Without `pullToRefresh` it is a plain scrollport (`.ptr-scroll`) and the pull props are ignored.

## Color

The indicator uses `currentColor` / `CanvasText`, so it follows the surrounding text. Override with custom properties on `.pull-to-refresh-root`:

| Variable | Role |
| --- | --- |
| `--ptr-color` | Text color of the scroller |
| `--ptr-accent` | Ring's leading edge |
| `--ptr-armed` | Leading edge once armed |
| `--ptr-track` | Rest of the ring |
| `--ptr-label` | Label |
| `--ptr-label-armed` | Label once armed |
| `--ptr-size` | Ring box (`2.35rem`) |
| `--ptr-gap` | Gap between ring and label (`0.35rem`) |
| `--ptr-label-size` | Label size (`0.75rem`) |
| `--ptr-header-offset` | Shift the slot below an overlaying bar |
| `--ptr-focus` | Focus outline |

Font, size, gap, and letter-spacing do not change between idle, pulling, armed, and refreshing. The label crossfades inside a fixed box. Collapse fades opacity only.

Phases on the root: `data-ptr-phase` is `idle`, `pulling`, `armed`, `refreshing`, or `collapsing`. `data-ptr-dragging` and `data-ptr-settling` are `"true"` or `"false"`. `--ptr-pull` is the content offset in px.

## Accessibility

The scroller is a named region and can take keyboard focus so it can be scrolled. The indicator is a polite live region (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`). It is hidden from assistive tech while idle, and `aria-busy` is set while refreshing.

`prefers-reduced-motion: reduce` shortens the settle to 120ms, skips the spin, and skips the haptic.

## Next.js

The package does not depend on Next.js. The entry file starts with `"use client"` so a server component can render it. `router.refresh()` is one possible `onRefresh`:

```tsx
"use client";

import { PullToRefresh, useOnPullRefresh } from "@simbiolabs/pull-to-refresh";
import "@simbiolabs/pull-to-refresh/styles.css";
import { useRouter } from "next/navigation";

export function Shell({ children }) {
  const router = useRouter();
  return (
    <div className="ptr-shell">
      <header className="app-bar">App</header>
      <PullToRefresh onRefresh={() => router.refresh()}>{children}</PullToRefresh>
    </div>
  );
}

export function Page() {
  useOnPullRefresh(() => refetch());
  return <main>{/* … */}</main>;
}
```

## WebKit

These are the bugs the gesture is built around.

- `touchmove` is registered with `{ passive: false }` so `preventDefault` can cancel a rubber-band. At scroll top (within 1px), the first downward move is claimed immediately. WebKit starts a rubber-band on the first uncancelled `touchmove` and then ignores a later `preventDefault`. That rubber-band snaps back with no indicator.
- The content offset is written every animation frame (`translate3d(0, var(--ptr-pull), 0)` with `transition: none`). A CSS transition on a transform that reads a custom property snaps to the end on WebKit.
- The indicator is centered with a constant `transform: translateX(-50%)`. WebKit treats the `translate` property as `none` when `transform` is `none`, which pins the left edge at 50% and shifts the indicator off center. The centering transform does not change during the pull, so nothing in the label reflows.
- The shell uses `100dvh`, not `100lvh`. `100lvh` is taller than Safari's visible viewport: the first line slides under a fixed bar, and the end of the scrollport sits behind the toolbar.
- `overflow-anchor: none` on the scroller and the content. Otherwise the browser can bump `scrollTop` while the transform changes and shove the first line back under the bar. If that bump happens mid-pull, the scroller is pinned to the top instead of dropping the gesture.

A horizontal pan, a list that is already scrolled, a focused field, and a nested scrollport stay with the browser.

## Lower-level pieces

The same primitives are exported if you need a different indicator or another pull:

- `bindVerticalPullGesture` / `usePullGesture`
- `animateOffset` / `useAnimatedOffset` / `cubicBezierEase`
- `resistPull`, `pullProgress`, `phaseForPull`, `releaseSettleTarget`
- `RefreshIndicator`, `CrossfadeLabel`

Settle easing is `cubic-bezier(0.22, 1, 0.36, 1)` over 300ms (`PULL_SETTLE_MS`, `PULL_EASE`).

## Stories

```bash
npm run storybook
```

Idle, pulling, armed, refreshing, an interactive list, disabled, `ScrollContainer`, and a custom indicator.

## License

MIT. See [LICENSE](./LICENSE).

Copyright (c) 2026 Simbio Labs LTDA.

"Simbio" and "Simbio Labs" are company names not covered by the license.

Contributions use a Developer Certificate of Origin sign-off. See [CONTRIBUTING.md](./CONTRIBUTING.md).
