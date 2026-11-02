import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";

const CLIENT_DIRECTIVE = '"use client";\n';

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ["react", "react-dom", "react/jsx-runtime"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
  async onSuccess() {
    mkdirSync("dist", { recursive: true });
    copyFileSync("src/styles.css", "dist/styles.css");
    // esbuild drops a directive prologue while bundling. Next.js reads it
    // from the published entry, so put it back after the bundle is written.
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const source = readFileSync(file, "utf8");
      if (!source.startsWith(CLIENT_DIRECTIVE)) {
        writeFileSync(file, CLIENT_DIRECTIVE + source);
      }
    }
  },
});
