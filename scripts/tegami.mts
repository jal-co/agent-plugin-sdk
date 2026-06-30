import { tegami } from "tegami";
import { createCli } from "tegami/cli";
import { github } from "tegami/plugins/github";

/**
 * Release configuration for the monorepo.
 *
 * The npm plugin is enabled by default and auto-discovers pnpm workspace
 * packages. Only `ap-sdk` is publishable — the repo root and `@jal-co/docs`
 * are private, so Tegami versions but never publishes them.
 *
 * Flow: write changelog files under `.tegami/`, then CI (`tegami ci`) opens a
 * "Version Packages" PR; merging it publishes to npm and cuts GitHub releases.
 */
const release = tegami({
  plugins: [
    github({
      repo: "jal-co/agent-plugin-sdk",
      versionPr: {
        base: "main",
        // Conventional title so the squashed merge commit passes commit-check.
        create: () => ({ title: "chore(release): version packages" }),
      },
    }),
  ],
});

void createCli(release).parseAsync();
