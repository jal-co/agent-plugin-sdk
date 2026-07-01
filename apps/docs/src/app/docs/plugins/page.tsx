import type { Metadata } from "next";
import { PluginDirectory } from "@/components/plugin-directory";
import { fetchPluginEntries } from "@/lib/github-plugins";

export const metadata: Metadata = {
  title: "Plugins",
  description:
    "Community plugins built with ap-sdk — tag your repo ap-sdk-plugin to get listed.",
};

export default async function PluginsPage() {
  const entries = await fetchPluginEntries();

  return (
    <div className="mx-auto grid w-full max-w-[88rem] grid-cols-1 gap-10 px-6 pb-16 md:px-10">
      <div className="min-w-0">
        <div className="flex w-full max-w-[64rem] flex-col gap-8">
          <div className="flex flex-col gap-3 border-b border-border/60 pb-8">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Plugins
            </h1>
            <p className="text-pretty text-lg leading-8 text-muted-foreground">
              Community plugins built with ap-sdk. Install from GitHub or npm,
              and tag your repo <code>ap-sdk-plugin</code> to get listed.
            </p>
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 font-mono text-sm">
              npx ap-sdk install owner/repo
            </div>
            <p className="text-sm text-muted-foreground">
              New here? Read{" "}
              <a
                href="/docs/installing-plugins"
                className="text-foreground underline underline-offset-4"
              >
                installing plugins
              </a>
              .
            </p>
          </div>

          <PluginDirectory
            entries={entries ?? []}
            degraded={entries === null}
          />

          <section className="rounded-xl border border-border/60 bg-card/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Get listed
            </h2>
            <div className="mt-4 grid gap-5 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <h3 className="font-medium text-foreground">On GitHub</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    Keep a <code>plugin.ts</code> that passes{" "}
                    <code>npx ap-sdk check</code>.
                  </li>
                  <li>
                    Add the <code>ap-sdk-plugin</code> topic in About → Topics.
                  </li>
                  <li>Your repo appears here within the hour.</li>
                </ol>
              </div>
              <div>
                <h3 className="font-medium text-foreground">On npm</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>
                    Add <code>ap-sdk-plugin</code> to <code>package.json</code>{" "}
                    keywords.
                  </li>
                  <li>Publish the package.</li>
                  <li>
                    Users can install with{" "}
                    <code>npx ap-sdk install npm:&lt;package&gt;</code>.
                  </li>
                </ol>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              The template repo from the distribution spike should include the
              topic by default once it exists.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
