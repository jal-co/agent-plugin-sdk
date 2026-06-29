import { allHarnessIds, getHarness } from "@jal-co/agent-plugin-sdk";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HarnessShowcase } from "@/components/harness-showcase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Derived from the SDK registry at build time, so the marketing copy grows with
// the code instead of hardcoding a count that goes stale the moment we add one.
const harnessNames = allHarnessIds().map((id) => getHarness(id).displayName);
const harnessCount = harnessNames.length;
const featuredHarnesses = harnessNames.slice(0, 5).join(", ");

const features = [
  {
    label: "Skills & commands",
    desc: "Authored once, emitted in each harness's native format — SKILL.md, TOML, prompt files, and more.",
  },
  {
    label: "Structured warnings",
    desc: "Capability gaps surface as warnings, never wrong files. Correct outputs everywhere, no silent drops.",
  },
  {
    label: "CLI & scaffolding",
    desc: "Build, install, check, and scaffold an entirely new harness from the terminal.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-36 pb-16 text-center">
        <Badge
          variant="outline"
          className="rounded-full font-mono text-xs font-normal text-muted-foreground"
        >
          TypeScript SDK · {harnessCount} harnesses
        </Badge>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
          One plugin, every agent harness.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-balance text-muted-foreground">
          One TypeScript definition compiles to the native artifacts every
          coding agent expects — {featuredHarnesses}, and more.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Can't find yours?{" "}
          <Link
            href="/docs/harnesses"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Add it →
          </Link>
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/docs">
              Read the docs
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs/harnesses">Browse harnesses</Link>
          </Button>
        </div>
      </section>

      {/* Interactive native-output showcase */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <HarnessShowcase />
        <p className="mt-4 text-center font-mono text-xs text-muted-foreground">
          one input → the native artifact each harness loads. pick a target.
        </p>
      </section>

      {/* Features */}
      <section className="border-t">
        <div className="mx-auto grid max-w-6xl divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {features.map((f) => (
            <div key={f.label} className="flex flex-col gap-2 px-6 py-10">
              <h3 className="text-sm font-medium">{f.label}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Origins / credit */}
      <section className="border-t">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="font-mono text-xs tracking-widest text-muted-foreground">
            ORIGINS
          </p>
          <p className="mt-5 text-lg leading-relaxed">
            agent-plugin-sdk was created by{" "}
            <a
              href="https://github.com/jnsahaj"
              className="font-medium underline underline-offset-4 hover:text-foreground"
            >
              Sahaj Jain
            </a>
            , who designed its ai-sdk-style architecture — a portable plugin
            definition, a declarative capability map, and structured warnings
            instead of silent failures — and shipped skills, commands,
            subagents, hooks, MCP, and shared tools across Claude Code, Codex,
            Pi, and OpenCode.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            This project continues that work with his blessing. Building on his
            foundation, we added four more harnesses — Gemini CLI, GitHub
            Copilot, Cursor, and Windsurf — a runtime registry and an{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
              add-harness
            </code>{" "}
            scaffold so the list keeps growing, and a monorepo with these docs.
            The architecture is still his; we are standing on it.
          </p>
        </div>
      </section>
    </>
  );
}
