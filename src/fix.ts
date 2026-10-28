import { writeFile } from "node:fs/promises";
import { applyEdits } from "./edits.js";
import type { FileResult } from "./scan.js";
import type { Edit } from "./types.js";

export interface FixedFile {
  file: string;
  output: string;
  applied: number;
}

/** Applies every issue's edits per file. Writes files unless dryRun. */
export async function applyFixes(results: FileResult[], { dryRun = false } = {}): Promise<FixedFile[]> {
  const fixed: FixedFile[] = [];
  for (const r of results) {
    const fixable = r.issues.filter((i) => i.edits?.length);
    if (fixable.length === 0) continue;
    const edits: Edit[] = fixable.flatMap((i) => i.edits!);
    const { output, skipped } = applyEdits(r.source, edits);
    for (const issue of fixable) {
      if (issue.edits!.some((e) => skipped.includes(e))) issue.edits = undefined;
    }
    if (output === r.source) continue;
    if (!dryRun) await writeFile(r.file, output);
    fixed.push({ file: r.file, output, applied: fixable.filter((i) => i.edits).length });
  }
  return fixed;
}
