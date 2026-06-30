import { defineTool, text } from "@jalco/ap-sdk/runtime";

export default [
  defineTool<{ msg: string }>({
    name: "echo",
    description: "Echo a message back, upper-cased.",
    parameters: {
      type: "object",
      properties: { msg: { type: "string" } },
      required: ["msg"],
    },
    execute({ msg }) {
      return text(`ECHO: ${msg.toUpperCase()}`);
    },
  }),
];
