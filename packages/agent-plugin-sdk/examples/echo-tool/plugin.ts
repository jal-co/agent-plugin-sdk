import { definePlugin } from "@jalco/ap-sdk";

export default definePlugin({
  id: "echo-tool",
  description: "A demo plugin with one shared tool.",
  tools: { module: "./tools.ts", names: ["echo"] },
});
