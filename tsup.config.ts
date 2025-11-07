import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "index-debug": "src/index-debug.ts",
  },
  outDir: "dist",
  format: ["esm"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
});
