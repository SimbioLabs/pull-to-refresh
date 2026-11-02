import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const SKIP = new Set([
  "node_modules",
  "dist",
  "storybook-static",
  "coverage",
  ".git",
]);

function word(...parts: string[]) {
  return new RegExp(parts.join(""), "i");
}

const BANNED: Array<{ name: string; re: RegExp }> = [
  { name: "product", re: word("lu", "mina") },
  { name: "secrets host", re: word("dop", "pler") },
  { name: "hosted db", re: word("supa", "base") },
  { name: "theme", re: word("ta", "rot") },
  { name: "item", re: word("amu", "let") },
  { name: "github token", re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "npm token", re: /npm_[A-Za-z0-9]{20,}/ },
  { name: "aws key", re: /AKIA[0-9A-Z]{16}/ },
  {
    name: "private key",
    re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  },
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...files(path));
    else out.push(path);
  }
  return out;
}

describe("source scan", () => {
  it("has no product names, internal hosts, or secrets", () => {
    const hits: string[] = [];
    for (const path of files(ROOT)) {
      if (path.endsWith("package-lock.json")) continue;
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      if (text.includes("\0")) continue;
      for (const ban of BANNED) {
        if (ban.re.test(text)) hits.push(`${ban.name} in ${path}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
