"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { HarnessLogo } from "@/components/harness-logo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Harness = {
  id: string;
  label: string;
  file: string;
  code: string;
};

const HARNESSES: Harness[] = [
  {
    id: "claude",
    label: "Claude",
    file: ".mcp.json",
    code: `{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "server-github"],
      "env": { "GITHUB_TOKEN": "\${GITHUB_TOKEN}" }
    }
  }
}`,
  },
  {
    id: "codex",
    label: "Codex",
    file: "agents/pr-reviewer.toml",
    code: `name = "pr-reviewer"
description = "Reviews a diff before a PR."
model = "gpt-5.4-mini"
developer_instructions = """
You are a meticulous reviewer. Flag bugs,
security issues, and missing tests.
"""`,
  },
  {
    id: "gemini",
    label: "Gemini",
    file: "gemini-extension.json",
    code: `{
  "name": "git-helper",
  "version": "1.0.0",
  "contextFileName": "GEMINI.md",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "server-github"]
    }
  }
}`,
  },
  {
    id: "copilot",
    label: "Copilot",
    file: ".github/prompts/commit.prompt.md",
    code: `---
description: Write a conventional commit.
argument-hint: "[scope]"
model: Claude Sonnet 4.5
---
Write a Conventional Commit message for the
staged diff. Scope: $ARGUMENTS`,
  },
  {
    id: "cursor",
    label: "Cursor",
    file: ".cursor/mcp.json",
    code: `{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "server-github"]
    }
  }
}`,
  },
  {
    id: "windsurf",
    label: "Windsurf",
    file: ".windsurf/workflows/commit.md",
    code: `---
description: Write a conventional commit.
---
Write a Conventional Commit message for the
staged diff, grouped by intent.`,
  },
  {
    id: "pi",
    label: "Pi",
    file: "package.json",
    code: `{
  "name": "git-helper",
  "pi": {
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  }
}`,
  },
  {
    id: "opencode",
    label: "OpenCode",
    file: "opencode.json",
    code: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "server-github"],
      "enabled": true
    }
  }
}`,
  },
];

export function HarnessShowcase() {
  const [activeId, setActiveId] = useState("gemini");
  const [copied, setCopied] = useState(false);
  const active = HARNESSES.find((h) => h.id === activeId) ?? HARNESSES[0];

  async function copy() {
    await navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const lines = active.code.split("\n");

  return (
    <Card className="w-full gap-0 overflow-hidden py-0 shadow-lg">
      {/* Switcher */}
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span className="tracking-widest">TARGET HARNESS</span>
          <span className="hidden sm:inline">one input → native output</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HARNESSES.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setActiveId(h.id)}
              title={h.label}
              aria-label={h.label}
              aria-pressed={h.id === activeId}
              className={cn(
                "grid size-9 place-items-center rounded-md transition-colors",
                h.id === activeId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <HarnessLogo id={h.id} className="size-[18px]" />
            </button>
          ))}
        </div>
      </div>

      {/* File bar */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[13px]">
          <span className="text-muted-foreground">{">_"}</span>
          <span className="text-muted-foreground">{active.label}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground">{active.file}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <div className="flex gap-4 overflow-x-auto px-4 py-4 font-mono text-[13px] leading-6">
        <pre className="shrink-0 text-right text-muted-foreground/40 select-none">
          {lines.map((_, i) => i + 1).join("\n")}
        </pre>
        <pre className="text-foreground/90">{active.code}</pre>
      </div>
    </Card>
  );
}
