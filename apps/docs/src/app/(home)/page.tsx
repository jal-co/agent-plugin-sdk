import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col justify-center text-center px-4">
      <h1 className="text-3xl font-bold mb-4">agent-plugin-sdk</h1>
      <p className="text-fd-muted-foreground max-w-xl mx-auto">
        Write an agent plugin once, ship it to every harness — Claude Code,
        Codex, Pi, and OpenCode. Skills, commands, subagents, hooks, MCP, and
        shared tools from one TypeScript definition.
      </p>
      <p className="mt-6">
        <Link href="/docs" className="font-medium underline underline-offset-4">
          Read the docs →
        </Link>
      </p>
    </main>
  );
}
