import { stringify } from "yaml";

/**
 * Render a `SKILL.md` (or any markdown-with-frontmatter file).
 *
 * `data` is serialized to YAML frontmatter with stable key order (insertion
 * order of the object). We delegate quoting/escaping to the `yaml` library so
 * descriptions containing colons, quotes, or newlines are always emitted safely.
 */
export function renderFrontmatterDoc(
  data: Record<string, unknown>,
  body: string,
): string {
  const yaml = stringify(data, {
    lineWidth: 0, // never wrap — wrapping a description mid-line hurts readability
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  }).trimEnd();

  const trimmedBody = body.replace(/^\n+/, "").trimEnd();
  return `---\n${yaml}\n---\n\n${trimmedBody}\n`;
}

/** Map a record's values through `fn`, preserving keys and insertion order. */
export function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => U,
): Record<string, U> {
  const out: Record<string, U> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = fn(v, k);
  return out;
}

/** Drop keys whose value is `undefined`/`null`/empty so frontmatter stays clean. */
/**
 * Merge escape-hatch frontmatter into a harness-built frontmatter object. The
 * base (the SDK's known fields) wins on a key clash — passthrough only *adds*
 * fields the SDK doesn't model, preserving key order.
 */
export function mergeFrontmatter(
  base: Record<string, unknown>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  if (!extra) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (!(key in merged)) merged[key] = value;
  }
  return merged;
}

export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.length === 0) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
