import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { siteUrl } from "@/lib/shared";
import "./global.css";

const description =
  "Write an agent plugin once, ship it to every harness. Define skills, commands, and tools in one place and compile them to the native artifacts Claude Code, Codex, Gemini CLI, Copilot, Cursor, Windsurf, Pi, and OpenCode each expect.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ap-sdk — one agent plugin, every harness",
    template: "%s — ap-sdk",
  },
  description,
  applicationName: "ap-sdk",
  keywords: [
    "ap-sdk",
    "agent-plugin-sdk",
    "agent plugins",
    "ai sdk for agents",
    "claude code",
    "codex",
    "gemini cli",
    "github copilot",
    "cursor",
    "windsurf",
    "opencode",
    "pi",
    "agent skills",
    "mcp",
    "slash commands",
    "subagents",
  ],
  authors: [{ name: "Justin Levine" }],
  creator: "Justin Levine",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "ap-sdk",
    title: "ap-sdk — one agent plugin, every harness",
    description,
    images: [{ url: "/og.png", width: 1280, height: 640, alt: "ap-sdk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ap-sdk — one agent plugin, every harness",
    description,
    images: ["/og.png"],
  },
};

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
