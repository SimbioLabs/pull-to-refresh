import { describe, expect, it, vi } from "vitest";
import {
  bindVerticalPullGesture,
  isBlockedPullTarget,
  isEditableFocused,
  isVerticalDownPull,
  lockPullDirection,
  scrollTopAllowsPull,
  shouldClaimPullTouchMove,
} from "./gesture";

describe("scrollTopAllowsPull", () => {
  it("allows a 1px drift and rejects a real scroll", () => {
    expect(scrollTopAllowsPull({ scrollTop: 0 } as HTMLElement)).toBe(true);
    expect(scrollTopAllowsPull({ scrollTop: 0.5 } as HTMLElement)).toBe(true);
    expect(scrollTopAllowsPull({ scrollTop: 12 } as HTMLElement)).toBe(false);
  });
});

describe("shouldClaimPullTouchMove", () => {
  it("claims the first downward pixels at the top", () => {
    expect(shouldClaimPullTouchMove(0, 2, true, null)).toBe(true);
    expect(shouldClaimPullTouchMove(4, 30, true, null)).toBe(true);
  });

  it("leaves horizontal pans and scrolled content to the browser", () => {
    expect(shouldClaimPullTouchMove(20, 4, true, null)).toBe(false);
    expect(shouldClaimPullTouchMove(0, 30, false, null)).toBe(false);
    expect(shouldClaimPullTouchMove(0, 30, true, "scroll")).toBe(false);
    expect(shouldClaimPullTouchMove(0, -8, true, null)).toBe(false);
  });
});

describe("isVerticalDownPull / lockPullDirection", () => {
  it("locks pull only for a clear downward move at the top", () => {
    expect(isVerticalDownPull(5, 30)).toBe(true);
    expect(isVerticalDownPull(40, 20)).toBe(false);
    expect(lockPullDirection({ dx: 5, dy: 30, atScrollTop: true })).toBe("pull");
    expect(lockPullDirection({ dx: 5, dy: 30, atScrollTop: false })).toBe(
      "scroll",
    );
    expect(lockPullDirection({ dx: 2, dy: 2, atScrollTop: true })).toBe(null);
  });
});

type FakeTouch = { identifier: number; clientX: number; clientY: number };

function touchList(touches: FakeTouch[]) {
  const list: {
    length: number;
    item: (index: number) => FakeTouch | null;
  } & Record<number, FakeTouch> = {
    length: touches.length,
    item: (index) => touches[index] ?? null,
  };
  touches.forEach((touch, index) => {
    list[index] = touch;
  });
  return list;
}

function fire(
  el: HTMLElement,
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  x: number,
  y: number,
  touches = 1,
) {
  const points = Array.from({ length: touches }, (_, index) => ({
    identifier: index + 1,
    clientX: x + index,
    clientY: y,
  }));
  const ended = type === "touchend" || type === "touchcancel";
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: touchList(ended ? [] : points),
  });
  el.dispatchEvent(event);
  return event;
}

describe("bindVerticalPullGesture", () => {
  it("claims a downward move at the top and reports the resisted pull", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const pulls: number[] = [];
    const release = vi.fn();
    const stop = bindVerticalPullGesture({
      target: el,
      resist: (dy) => dy * 0.5,
      onPull: (px) => pulls.push(px),
      onRelease: release,
    });
    const before = fire(el, "touchmove", 0, 80);
    expect(before.defaultPrevented).toBe(false);
    fire(el, "touchstart", 0, 10);
    const claimed = fire(el, "touchmove", 0, 90);
    expect(claimed.defaultPrevented).toBe(true);
    expect(pulls.at(-1)).toBe(40);
    fire(el, "touchend", 0, 90);
    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({ pullPx: 40, rawDy: 80 }),
    );
    stop();
    el.remove();
  });

  it("does not cancel a horizontal pan", () => {
    const el = document.createElement("div");
    const pulls: number[] = [];
    bindVerticalPullGesture({
      target: el,
      onPull: (px) => pulls.push(px),
      onRelease: () => {},
    });
    fire(el, "touchstart", 0, 0);
    const move = fire(el, "touchmove", 40, 6);
    expect(move.defaultPrevented).toBe(false);
    expect(pulls).toEqual([]);
  });

  it("does not start when the scroller is already away from the top", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", { value: 24, writable: true });
    const pulls: number[] = [];
    bindVerticalPullGesture({
      target: el,
      onPull: (px) => pulls.push(px),
      onRelease: () => {},
    });
    fire(el, "touchstart", 0, 0);
    const move = fire(el, "touchmove", 0, 80);
    expect(move.defaultPrevented).toBe(false);
    expect(pulls).toEqual([]);
  });

  it("pins scrollTop instead of dropping a pull that is already owned", () => {
    const el = document.createElement("div");
    let top = 0;
    Object.defineProperty(el, "scrollTop", {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value;
      },
    });
    bindVerticalPullGesture({
      target: el,
      resist: (dy) => dy,
      onPull: () => {},
      onRelease: () => {},
    });
    fire(el, "touchstart", 0, 0);
    fire(el, "touchmove", 0, 40);
    top = 12;
    fire(el, "touchmove", 0, 64);
    expect(top).toBe(0);
  });

  it("ignores a blocked target and cancels on touchcancel", () => {
    const el = document.createElement("div");
    const input = document.createElement("input");
    el.appendChild(input);
    const start = vi.fn();
    const cancel = vi.fn();
    bindVerticalPullGesture({
      target: el,
      isBlockedTarget: (target) =>
        target instanceof Element && Boolean(target.closest("input")),
      onPullStart: start,
      onPull: () => {},
      onRelease: () => {},
      onCancel: cancel,
    });
    input.dispatchEvent(fakeTouch("touchstart", 0, 0, input));
    input.dispatchEvent(fakeTouch("touchmove", 0, 40, input));
    expect(start).not.toHaveBeenCalled();

    fire(el, "touchstart", 0, 0);
    fire(el, "touchmove", 0, 30);
    fire(el, "touchcancel", 0, 30);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("drops the gesture when a second finger lands", () => {
    const el = document.createElement("div");
    const cancel = vi.fn();
    bindVerticalPullGesture({
      target: el,
      onPull: () => {},
      onRelease: () => {},
      onCancel: cancel,
    });
    fire(el, "touchstart", 0, 0);
    fire(el, "touchmove", 0, 40);
    fire(el, "touchstart", 10, 10, 2);
    expect(cancel).toHaveBeenCalled();
  });
});

function fakeTouch(
  type: "touchstart" | "touchmove",
  x: number,
  y: number,
  target: EventTarget,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: touchList([{ identifier: 1, clientX: x, clientY: y }]),
  });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("isBlockedPullTarget / isEditableFocused", () => {
  it("blocks fields, data-no-ptr, and a nested scroller", () => {
    const scroller = document.createElement("div");
    const input = document.createElement("textarea");
    const marked = document.createElement("div");
    marked.setAttribute("data-no-ptr", "");
    const nested = document.createElement("div");
    nested.style.overflowY = "auto";
    Object.defineProperty(nested, "scrollHeight", { value: 400 });
    Object.defineProperty(nested, "clientHeight", { value: 80 });
    const plain = document.createElement("p");
    scroller.append(input, marked, nested, plain);

    expect(isBlockedPullTarget(input, scroller)).toBe(true);
    expect(isBlockedPullTarget(marked, scroller)).toBe(true);
    expect(isBlockedPullTarget(nested, scroller)).toBe(true);
    expect(isBlockedPullTarget(plain, scroller)).toBe(false);
    expect(isBlockedPullTarget(plain, scroller, "[data-extra]")).toBe(false);
    plain.setAttribute("data-extra", "");
    expect(isBlockedPullTarget(plain, scroller, "[data-extra]")).toBe(true);
  });

  it("treats a focused field as editing", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(isEditableFocused()).toBe(true);
    input.blur();
    expect(isEditableFocused()).toBe(false);
    input.remove();
  });
});
