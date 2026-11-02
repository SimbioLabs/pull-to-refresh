import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PULL_REFRESH_REST_PX } from "./math";
import {
  PullToRefresh,
  ScrollContainer,
  useDisablePullToRefresh,
  useOnPullRefresh,
} from "./pull-to-refresh";

type Frame = FrameRequestCallback;

function installBrowser() {
  const queue: Frame[] = [];
  let now = 0;
  vi.stubGlobal("performance", { now: () => now });
  vi.stubGlobal("requestAnimationFrame", (cb: Frame) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const queries = new Map<string, boolean>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return queries.get(query) ?? false;
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
  const vibrate = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: vibrate,
  });
  return {
    vibrate,
    setQuery(query: string, matches: boolean) {
      queries.set(query, matches);
    },
    flush() {
      let guard = 0;
      while (queue.length && guard < 40) {
        now += 32;
        const cb = queue.shift();
        cb?.(now);
        guard += 1;
      }
    },
  };
}

function touchList(x: number, y: number, count: number) {
  const points = Array.from({ length: count }, (_, index) => ({
    identifier: index + 1,
    clientX: x,
    clientY: y,
  }));
  const list: {
    length: number;
    item: (index: number) => (typeof points)[number] | null;
  } & Record<number, (typeof points)[number]> = {
    length: points.length,
    item: (index) => points[index] ?? null,
  };
  points.forEach((point, index) => {
    list[index] = point;
  });
  return list;
}

function fire(
  el: Element,
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  x: number,
  y: number,
) {
  const ended = type === "touchend" || type === "touchcancel";
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: touchList(x, y, ended ? 0 : 1),
  });
  el.dispatchEvent(event);
  return event;
}

async function pull(el: Element, dy: number, browser: { flush: () => void }) {
  await act(async () => {
    fire(el, "touchstart", 40, 30);
    fire(el, "touchmove", 40, 30 + dy);
  });
  await act(async () => {
    fire(el, "touchend", 40, 30 + dy);
    for (let i = 0; i < 16; i += 1) {
      browser.flush();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function rootOf(container: HTMLElement) {
  const root = container.querySelector(".pull-to-refresh-root");
  if (!(root instanceof HTMLElement)) throw new Error("missing scroller");
  return root;
}

describe("PullToRefresh", () => {
  let browser: ReturnType<typeof installBrowser>;

  beforeEach(() => {
    browser = installBrowser();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stays idle and hides the indicator until a pull", () => {
    const { container } = render(
      <PullToRefresh>
        <p>First line</p>
      </PullToRefresh>,
    );
    const root = rootOf(container);
    expect(root.getAttribute("data-ptr-phase")).toBe("idle");
    expect(root.getAttribute("role")).toBe("region");
    expect(root.getAttribute("aria-label")).toBe("Scrollable content");
    const indicator = screen.getByTestId("pull-to-refresh");
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
    expect(indicator.getAttribute("aria-live")).toBe("polite");
    expect(root.style.getPropertyValue("--ptr-pull")).toBe("0px");
  });

  it("arms past the threshold, refreshes, then returns to idle", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onRefresh = vi.fn(() => gate);
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>First line</p>
      </PullToRefresh>,
    );
    const root = rootOf(container);
    await act(async () => {
      fire(root, "touchstart", 40, 30);
      fire(root, "touchmove", 40, 230);
    });
    expect(root.getAttribute("data-ptr-phase")).toBe("armed");
    expect(root.getAttribute("data-ptr-dragging")).toBe("true");
    expect(parseFloat(root.style.getPropertyValue("--ptr-pull"))).toBeGreaterThan(
      70,
    );
    expect(screen.getByText("Release to refresh").className).toContain(
      "is-active",
    );
    expect(browser.vibrate).toHaveBeenCalledWith(12);
    expect(browser.vibrate).toHaveBeenCalledTimes(1);

    await act(async () => {
      fire(root, "touchend", 40, 230);
      for (let i = 0; i < 8; i += 1) {
        browser.flush();
        await Promise.resolve();
      }
    });
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(root.getAttribute("data-ptr-phase")).toBe("refreshing");
    expect(screen.getByTestId("pull-to-refresh").className).toContain(
      "is-spinning",
    );
    expect(parseFloat(root.style.getPropertyValue("--ptr-pull"))).toBeCloseTo(
      PULL_REFRESH_REST_PX,
      0,
    );

    await act(async () => {
      release();
      for (let i = 0; i < 8; i += 1) {
        browser.flush();
        await Promise.resolve();
      }
    });
    expect(root.getAttribute("data-ptr-phase")).toBe("idle");
    expect(parseFloat(root.style.getPropertyValue("--ptr-pull"))).toBe(0);
    expect(root.getAttribute("data-ptr-dragging")).toBe("false");
  });

  it("eases back without refreshing when the pull is short", async () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>First line</p>
      </PullToRefresh>,
    );
    const root = rootOf(container);
    await pull(root, 30, browser);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(root.getAttribute("data-ptr-phase")).toBe("idle");
    expect(parseFloat(root.style.getPropertyValue("--ptr-pull"))).toBe(0);
  });

  it("does not take a horizontal pan or a scrolled list", async () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>First line</p>
      </PullToRefresh>,
    );
    const root = rootOf(container);
    await act(async () => {
      fire(root, "touchstart", 10, 10);
      fire(root, "touchmove", 80, 16);
      fire(root, "touchend", 80, 16);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(root.getAttribute("data-ptr-dragging")).toBe("false");
    expect(parseFloat(root.style.getPropertyValue("--ptr-pull"))).toBe(0);

    Object.defineProperty(root, "scrollTop", {
      configurable: true,
      value: 40,
    });
    await act(async () => {
      fire(root, "touchstart", 10, 10);
      fire(root, "touchmove", 10, 200);
    });
    expect(root.getAttribute("data-ptr-phase")).toBe("idle");
  });

  it("ignores fields, marked regions, and nested scrollers", async () => {
    const onRefresh = vi.fn();
    const { container } = render(
      <PullToRefresh onRefresh={onRefresh}>
        <input aria-label="Name" />
        <div data-no-ptr>Sheet</div>
        <div data-testid="nested" style={{ overflowY: "auto" }}>
          Nested
        </div>
      </PullToRefresh>,
    );
    const root = rootOf(container);
    const nested = screen.getByTestId("nested");
    Object.defineProperty(nested, "scrollHeight", { value: 500 });
    Object.defineProperty(nested, "clientHeight", { value: 40 });
    for (const el of [
      screen.getByLabelText("Name"),
      screen.getByText("Sheet"),
      nested,
    ]) {
      await act(async () => {
        fire(el, "touchstart", 10, 10);
        fire(el, "touchmove", 10, 220);
        fire(el, "touchend", 10, 220);
      });
    }
    expect(onRefresh).not.toHaveBeenCalled();
    expect(parseFloat(root.style.getPropertyValue("--ptr-pull"))).toBe(0);
  });

  it("runs hook handlers after onRefresh and survives a rejection", async () => {
    const order: string[] = [];
    function Page() {
      useOnPullRefresh(async () => {
        order.push("hook");
      });
      return <p>Page</p>;
    }
    const { container } = render(
      <PullToRefresh
        onRefresh={async () => {
          order.push("prop");
          throw new Error("refetch failed");
        }}
      >
        <Page />
      </PullToRefresh>,
    );
    await pull(rootOf(container), 200, browser);
    expect(order).toEqual(["prop", "hook"]);
    expect(rootOf(container).getAttribute("data-ptr-phase")).toBe("idle");
  });

  it("stays idle when disabled, when a child disables it, or past the breakpoint", async () => {
    const onRefresh = vi.fn();
    const { container, rerender } = render(
      <PullToRefresh disabled onRefresh={onRefresh}>
        <p>Locked</p>
      </PullToRefresh>,
    );
    await pull(rootOf(container), 200, browser);
    expect(onRefresh).not.toHaveBeenCalled();

    function Overlay() {
      useDisablePullToRefresh(true);
      return <p>Open</p>;
    }
    rerender(
      <PullToRefresh onRefresh={onRefresh}>
        <Overlay />
      </PullToRefresh>,
    );
    await pull(rootOf(container), 200, browser);
    expect(onRefresh).not.toHaveBeenCalled();

    browser.setQuery("(min-width: 1024px)", true);
    rerender(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Wide</p>
      </PullToRefresh>,
    );
    await pull(rootOf(container), 200, browser);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("skips the spin and the haptic when reduced motion is requested", async () => {
    browser.setQuery("(prefers-reduced-motion: reduce)", true);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { container } = render(
      <PullToRefresh onRefresh={() => gate}>
        <p>Quiet</p>
      </PullToRefresh>,
    );
    const root = rootOf(container);
    await act(async () => {
      fire(root, "touchstart", 0, 0);
      fire(root, "touchmove", 0, 200);
      fire(root, "touchend", 0, 200);
      for (let i = 0; i < 8; i += 1) {
        browser.flush();
        await Promise.resolve();
      }
    });
    expect(screen.getByTestId("pull-to-refresh").className).not.toContain(
      "is-spinning",
    );
    expect(browser.vibrate).not.toHaveBeenCalled();
    await act(async () => {
      release();
      browser.flush();
      await Promise.resolve();
    });
  });

  it("renders a custom indicator without scaling the slot", () => {
    const { container } = render(
      <PullToRefresh
        labels={{ pull: "Puxe", release: "Solte", refreshing: "Atualizando" }}
        renderIndicator={(state) => <span>Mark {state.phase}</span>}
      >
        <p>Body</p>
      </PullToRefresh>,
    );
    expect(screen.getByText("Mark idle")).toBeTruthy();
    expect(container.querySelector(".pull-to-refresh-ring")).toBeNull();
    expect(container.querySelector(".pull-to-refresh-indicator")).toBeTruthy();
  });

  it("forwards a ref and can render a plain scroll container", () => {
    const ref = { current: null as HTMLDivElement | null };
    const { rerender } = render(
      <ScrollContainer ref={ref}>
        <p>Plain</p>
      </ScrollContainer>,
    );
    expect(ref.current?.className).toContain("ptr-scroll");
    expect(document.querySelector(".pull-to-refresh-root")).toBeNull();
    rerender(
      <ScrollContainer ref={ref} pullToRefresh>
        <p>Pull</p>
      </ScrollContainer>,
    );
    expect(ref.current?.classList.contains("pull-to-refresh-root")).toBe(true);
  });
});
