import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ALLOW = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "BlueOak-1.0.0",
  "Python-2.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "MPL-2.0",
  "Unicode-3.0",
  "Unicode-DFS-2016",
]);

function readLicense(pkgJson) {
  const value = pkgJson.license ?? pkgJson.licenses;
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => entry.type || entry).join(" OR ");
  }
  if (typeof value === "object" && value.type) return value.type;
  return "";
}

function allowed(license) {
  if (!license) return false;
  const text = license.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  if (/^SEE LICENSE/i.test(text) || text === "UNLICENSED") return false;
  const orGroups = text.split(/\s+OR\s+/i);
  return orGroups.some((group) => {
    const parts = group.split(/\s+(?:AND|WITH)\s+/i).map((part) => part.trim());
    return parts.every((part) => ALLOW.has(part));
  });
}

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages ?? {};
const bad = [];
const tally = new Map();
let checked = 0;

for (const [name, meta] of Object.entries(packages)) {
  if (!name || !name.includes("node_modules")) continue;
  const dir = join(process.cwd(), name);
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const license = meta.license || readLicense(pkg);
  checked += 1;
  const label = String(license || "NO LICENSE");
  tally.set(label, (tally.get(label) ?? 0) + 1);
  if (!allowed(label)) {
    bad.push(`${name}: ${label}`);
  }
}

const root = JSON.parse(readFileSync("package.json", "utf8"));
const runtime = Object.keys(root.dependencies ?? {});
if (runtime.length > 0) {
  bad.push(`runtime dependencies are not allowed: ${runtime.join(", ")}`);
}

console.log(`checked ${checked} packages`);
const summary = [...tally.entries()].sort((a, b) => b[1] - a[1]);
for (const [license, count] of summary) {
  console.log(`  ${count}\t${license}`);
}
if (bad.length) {
  console.error(bad.join("\n"));
  process.exit(1);
}
console.log("licenses ok");
