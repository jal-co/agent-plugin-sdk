import { ArrowRight, Copy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const harnesses = [
  "Claude",
  "Codex",
  "Gemini",
  "Copilot",
  "Cursor",
  "Windsurf",
  "Pi",
  "OpenCode",
];

const features = [
  {
    label: "Skills & commands",
    desc: "Authored once, emitted in each harness's native format.",
  },
  {
    label: "Structured warnings",
    desc: "Capability gaps surface as warnings, never wrong files.",
  },
  {
    label: "CLI & scaffolding",
    desc: "Build, install, check, and add new harnesses from the terminal.",
  },
];

const code = `{
  "name": "git-helper",
  "version": "1.0.0",
  "description": "Git review helpers.",
  "contextFileName": "GEMINI.md",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "server-github"]
    }
  }
}`;

const lineNumbers = code
  .split("\n")
  .map((_, i) => i + 1)
  .join("\n");

export default function HomePage() {
  return (
    <main className="dark flex flex-1 flex-col bg-[#0C0C0F] text-[#F4F3EE]">
      <section className="mx-auto grid w-full max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[minmax(0,560px)_1fr] lg:items-center lg:gap-10 lg:py-28">
        {/* Left column */}
        <div className="flex flex-col justify-center gap-9">
          <div>
            <p className="font-mono text-[13px] tracking-[0.2em] text-[#FFC93D]">
              AGENT-PLUGIN-SDK
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl lg:text-[5.1rem]">
              One plugin, every agent harness.
            </h1>
          </div>

          <p className="max-w-md text-lg leading-relaxed text-[#9A9AA3]">
            One TypeScript definition compiles to the native artifacts every
            coding agent expects — Claude Code, Codex, Gemini, Copilot, Cursor,
            Windsurf, Pi, and OpenCode. One source of truth, eight correct
            outputs.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="h-11 bg-[#FFC93D] px-6 text-base text-[#0C0C0F] hover:bg-[#FFD45E]"
            >
              <Link href="/docs">
                Read the docs
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-[#2C2C33] bg-transparent px-6 text-base text-[#F4F3EE] hover:bg-[#1A1A20] hover:text-[#F4F3EE]"
            >
              <Link href="/docs/harnesses">Browse harnesses</Link>
            </Button>
          </div>

          <dl className="max-w-md">
            {features.map((f) => (
              <div
                key={f.label}
                className="flex gap-6 border-t border-[#1E1E24] py-[18px] last:border-b"
              >
                <dt className="w-[148px] shrink-0 text-[15px] font-semibold">
                  {f.label}
                </dt>
                <dd className="flex-1 text-[15px] leading-[1.45] text-[#9A9AA3]">
                  {f.desc}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right column — terminal */}
        <div className="flex items-center">
          <Card className="w-full gap-0 overflow-hidden border-[#1F1F26] bg-[#121217] py-0 shadow-2xl shadow-black/40">
            {/* Harness switcher */}
            <div className="flex flex-col gap-4 border-b border-[#1F1F26] p-5">
              <div className="flex items-center justify-between font-mono text-[12px] text-[#7E7E87]">
                <span className="tracking-[0.14em]">TARGET HARNESS</span>
                <span>one input → native output</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {harnesses.map((h) => (
                  <Badge
                    key={h}
                    className={cn(
                      "rounded-md border-transparent px-3 py-1.5 font-mono text-[12.5px] font-normal",
                      h === "Gemini"
                        ? "bg-[#FFC93D] font-semibold text-[#0C0C0F]"
                        : "bg-[#1A1A20] text-[#9A9AA3]",
                    )}
                  >
                    {h}
                  </Badge>
                ))}
              </div>
            </div>

            {/* File bar */}
            <div className="flex items-center justify-between border-b border-[#1F1F26] px-5 py-3.5">
              <div className="flex items-center gap-2.5 font-mono text-[13px]">
                <span className="text-[#FFC93D]">{">_"}</span>
                <span className="text-[#C9C9C4]">gemini-extension.json</span>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-[#2A2A31] px-3 py-1.5 text-[13px] text-[#9A9AA3] transition-colors hover:text-[#F4F3EE]"
              >
                <Copy className="size-3" />
                Copy
              </button>
            </div>

            {/* Code */}
            <div className="flex gap-5 overflow-x-auto bg-[#0F0F13] px-6 py-6 font-mono text-[13px] leading-[25px]">
              <pre className="shrink-0 text-right text-[#42424A] select-none">
                {lineNumbers}
              </pre>
              <pre className="text-[#CACAC4]">{code}</pre>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
