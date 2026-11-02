import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";

const files = ["dist/index.js", "dist/index.cjs", "dist/styles.css"];
const limit = 12 * 1024;

for (const file of files) {
  const buf = readFileSync(file);
  const gzip = gzipSync(buf).length;
  console.log(
    `${file}: ${statSync(file).size} bytes, gzip ${gzip}`,
  );
}

const esm = gzipSync(readFileSync("dist/index.js")).length;
if (esm > limit) {
  console.error(`dist/index.js gzip ${esm} exceeds ${limit}`);
  process.exit(1);
}
