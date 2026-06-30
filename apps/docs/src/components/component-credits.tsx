"use client";

/* ─────────────────────────────────────────────────────────
 * STATE STORYBOARD — Component credits modal
 *
 * Driven by a single `open` boolean, animated via AnimatePresence.
 *
 *   closed   backdrop transparent · panel scale 0.96, y 8, opacity 0
 *   open  →  backdrop fades up to a blurred scrim (BACKDROP.in) ·
 *            panel springs into place (PANEL.spring): scale→1, y→0, fade→1
 *   close →  the same values play in reverse through the exit variant
 * ───────────────────────────────────────────────────────── */

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/* Backdrop scrim — a quick, easing-based fade (no spring needed for opacity). */
const BACKDROP = {
  in: { duration: 0.18, ease: "easeOut" as const },
};

/* Panel — the credits card. Spring-first for a natural settle. */
const PANEL = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  shown: { opacity: 1, scale: 1, y: 0 },
  spring: { type: "spring" as const, stiffness: 360, damping: 30 },
};

/* Third-party UI this site is built on. Data-driven — add a row, get a credit. */
const CREDITS = [
  {
    name: "Code Block · Code Line · Command",
    role: "Syntax-highlighted code blocks",
    author: "jalco-ui",
    href: "https://ui.justinlevine.me",
  },
  {
    name: "Fumadocs",
    role: "MDX content & headless TOC",
    author: "Fuma Nama",
    href: "https://fumadocs.dev",
  },
];

export function ComponentCredits() {
  const [open, setOpen] = useState(false);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-muted-foreground transition-colors hover:text-foreground"
      >
        Component credits
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center p-4"
            initial="hidden"
            animate="shown"
            exit="hidden"
          >
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Close credits"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
              transition={BACKDROP.in}
            />

            {/* Panel */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="credits-title"
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl"
              variants={{ hidden: PANEL.hidden, shown: PANEL.shown }}
              transition={PANEL.spring}
            >
              <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
                <div className="flex flex-col gap-1">
                  <h2 id="credits-title" className="text-sm font-semibold">
                    Component credits
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    This UI is built on the shoulders of open-source components.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <ul className="flex flex-col divide-y divide-border/60">
                {CREDITS.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {c.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.role}
                      </span>
                    </div>
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {c.author}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
