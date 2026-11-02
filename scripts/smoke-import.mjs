import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const esm = await import("../dist/index.js");
const require = createRequire(import.meta.url);
const cjs = require("../dist/index.cjs");

const names = [
  "PullToRefresh",
  "ScrollContainer",
  "useOnPullRefresh",
  "useDisablePullToRefresh",
  "RefreshIndicator",
  "CrossfadeLabel",
  "usePullGesture",
  "useAnimatedOffset",
  "bindVerticalPullGesture",
  "animateOffset",
  "resistPull",
];

function present(value) {
  if (typeof value === "function") return true;
  return typeof value === "object" && value !== null && "$$typeof" in value;
}

for (const name of names) {
  if (!present(esm[name])) throw new Error(`esm export missing: ${name}`);
  if (!present(cjs[name])) throw new Error(`cjs export missing: ${name}`);
}

const esmSource = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
if (!esmSource.startsWith('"use client"') && !esmSource.startsWith("'use client'")) {
  throw new Error("esm bundle is missing the use client directive");
}

const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
if (!css.includes("translateX(-50%)") || !css.includes("100dvh")) {
  throw new Error("dist/styles.css is incomplete");
}

console.log("smoke ok");
