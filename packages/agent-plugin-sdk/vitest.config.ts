import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Map the package specifiers to source so example files (which import
// "@jalco/ap-sdk") resolve without a build step.
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    alias: {
      "@jalco/ap-sdk/runtime": src("./src/runtime/index.ts"),
      "@jalco/ap-sdk": src("./src/index.ts"),
    },
  },
});
