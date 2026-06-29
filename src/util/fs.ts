import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { OutputFile } from "../types.js";

/** Write one file, creating parent dirs and setting the exec bit if requested. */
export function writeOutputFile(absPath: string, file: OutputFile): void {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, file.content);
  if (file.executable) chmodSync(absPath, 0o755);
}

/** Write a set of files rooted at `root`, returning the absolute paths written. */
export function writeTree(root: string, files: OutputFile[]): string[] {
  return files.map((file) => {
    const abs = join(root, file.path);
    writeOutputFile(abs, file);
    return abs;
  });
}
