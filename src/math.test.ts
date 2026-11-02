import { describe, expect, it, vi } from "vitest";
import {
  phaseForPull,
  pullProgress,
  releaseSettleTarget,
  resistPull,
  triggerArmedHaptic,
  PULL_REFRESH_REST_PX,
  PULL_THRESHOLD_PX,
} from "./math";

describe("resistPull", () => {
  it("returns 0 for non-positive distance", () => {
    expect(resistPull(0)).toBe(0);
    expect(resistPull(-10)).toBe(0);
    expect(resistPull(40, 0)).toBe(0);
  });

  it("damps growth and never exceeds max", () => {
    const a = resistPull(40);
    const b = resistPull(80);
    const c = resistPull(400);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThanOrEqual(120);
    expect(c).toBeGreaterThan(b);
  });
});

describe("pullProgress / phaseForPull", () => {
  it("clamps progress to 0..1", () => {
    expect(pullProgress(0)).toBe(0);
    expect(pullProgress(PULL_THRESHOLD_PX / 2)).toBeCloseTo(0.5);
    expect(pullProgress(PULL_THRESHOLD_PX)).toBe(1);
    expect(pullProgress(200)).toBe(1);
    expect(pullProgress(10, 0)).toBe(0);
  });

  it("maps phases, and refreshing wins", () => {
    expect(phaseForPull(0, false)).toBe("idle");
    expect(phaseForPull(20, false)).toBe("pulling");
    expect(phaseForPull(PULL_THRESHOLD_PX, false)).toBe("armed");
    expect(phaseForPull(PULL_THRESHOLD_PX + 10, false)).toBe("armed");
    expect(phaseForPull(10, true)).toBe("refreshing");
    expect(phaseForPull(PULL_THRESHOLD_PX, true)).toBe("refreshing");
  });
});

describe("releaseSettleTarget", () => {
  it("arms refresh and rests past the threshold", () => {
    expect(releaseSettleTarget(PULL_THRESHOLD_PX)).toEqual({
      refresh: true,
      target: PULL_REFRESH_REST_PX,
    });
    expect(releaseSettleTarget(PULL_THRESHOLD_PX + 20)).toEqual({
      refresh: true,
      target: PULL_REFRESH_REST_PX,
    });
  });

  it("cancels below the threshold, ignoring speed", () => {
    expect(releaseSettleTarget(0)).toEqual({ refresh: false, target: 0 });
    expect(releaseSettleTarget(40)).toEqual({ refresh: false, target: 0 });
  });
});

describe("triggerArmedHaptic", () => {
  it("vibrates for 12ms when the platform allows it", () => {
    const vibrate = vi.fn(() => true);
    triggerArmedHaptic({ vibrate });
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it("swallows a missing or throwing vibrate", () => {
    expect(() => triggerArmedHaptic({})).not.toThrow();
    expect(() => triggerArmedHaptic(null)).not.toThrow();
    expect(() =>
      triggerArmedHaptic({
        vibrate: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
