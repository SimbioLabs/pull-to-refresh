import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "styles.css"),
  "utf8",
);

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(start, close + 1);
}

describe("styles", () => {
  it("centers the indicator with a constant translateX and never the translate property", () => {
    const indicator = block(".pull-to-refresh-indicator {");
    expect(indicator).toContain("transform: translateX(-50%)");
    expect(indicator).not.toContain("--ptr-pull");
    expect(indicator).not.toContain("--ptr-progress");
    expect(css).not.toMatch(/(^|\n)\s*translate\s*:/);
  });

  it("moves only the content, with no transform transition", () => {
    const content = block(".pull-to-refresh-content {");
    expect(content).toContain("translate3d(0, var(--ptr-pull, 0px), 0)");
    expect(content).toContain("transition: none");
    expect(css).not.toMatch(/transition:\s*transform/);
  });

  it("keeps indicator type metrics constant", () => {
    const copy = block(".pull-to-refresh-copy {");
    expect(copy).toContain("font-size: var(--ptr-label-size, 0.75rem)");
    expect(copy).toContain("letter-spacing: 0.01em");
    expect(copy).toContain("height: 1.05rem");
    const indicator = block(".pull-to-refresh-indicator {");
    expect(indicator).toContain("gap: var(--ptr-gap, 0.35rem)");
    const ring = block(".pull-to-refresh-ring {");
    expect(ring).toContain("width: var(--ptr-size, 2.35rem)");
    expect(ring).toContain("height: var(--ptr-size, 2.35rem)");
  });

  it("sizes the shell with 100dvh and respects reduced motion", () => {
    expect(css).toContain("height: 100dvh");
    expect(css).not.toMatch(/height:\s*100lvh/);
    expect(css).not.toMatch(/max-height:\s*100lvh/);
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("animation: none");
  });
});
