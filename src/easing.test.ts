import { describe, expect, it } from "vitest";
import { animateOffset, cubicBezierEase } from "./easing";
import { PULL_SETTLE_MS } from "./math";

describe("cubicBezierEase", () => {
  it("starts at 0 and ends at 1", () => {
    expect(cubicBezierEase(0)).toBe(0);
    expect(cubicBezierEase(1)).toBe(1);
  });

  it("is progressive for the shared settle curve", () => {
    const a = cubicBezierEase(0.25);
    const b = cubicBezierEase(0.5);
    const c = cubicBezierEase(0.75);
    expect(a).toBeGreaterThan(0.25);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(1);
  });
});

describe("animateOffset", () => {
  it("emits intermediate frames before the target", async () => {
    const values: number[] = [];
    let clock = 0;
    const queue: FrameRequestCallback[] = [];
    const raf = (cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length;
    };
    const done = animateOffset(90, 48, (px) => values.push(px), {
      durationMs: PULL_SETTLE_MS,
      now: () => clock,
      raf,
    });
    for (let i = 0; i <= 12; i += 1) {
      clock = i * 25;
      const cb = queue.shift();
      if (!cb) break;
      cb(clock);
    }
    await done;
    expect(values[values.length - 1]).toBe(48);
    expect(new Set(values.map((v) => Math.round(v))).size).toBeGreaterThanOrEqual(
      5,
    );
  });

  it("stops without snapping when cancelled", async () => {
    const values: number[] = [];
    let clock = 0;
    let cancelled = false;
    const queue: FrameRequestCallback[] = [];
    const done = animateOffset(0, 100, (px) => values.push(px), {
      durationMs: 300,
      now: () => clock,
      raf: (cb) => {
        queue.push(cb);
        return queue.length;
      },
      isCancelled: () => cancelled,
    });
    clock = 30;
    queue.shift()?.(clock);
    cancelled = true;
    clock = 300;
    queue.shift()?.(clock);
    await done;
    expect(values.length).toBeGreaterThan(0);
    expect(values[values.length - 1]).not.toBe(100);
  });

  it("applies the target immediately for a zero distance", async () => {
    const values: number[] = [];
    await animateOffset(12, 12.2, (px) => values.push(px), { durationMs: 300 });
    expect(values).toEqual([12.2]);
  });
});
