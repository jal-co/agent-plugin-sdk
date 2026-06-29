import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cli.ts",
    "src/runtime/index.ts",
    "src/harness.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
});
