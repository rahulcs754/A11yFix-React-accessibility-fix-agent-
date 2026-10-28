import path from "node:path";
import pc from "picocolors";
import type { FileResult } from "./scan.js";
import type { Issue } from "./types.js";

export interface Summary {
  files: number;
  issues: number;
  fixed: number;
  needsAi: number;
  manual: number;
  parseErrors: number;
}

export function summarize(results: FileResult[]): Summary {
  const issues = results.flatMap((r) => r.issues);
  return {
    files: results.length,
    issues: issues.length,
    fixed: issues.filter((i) => i.edits?.length).length,
    needsAi: issues.filter((i) => i.fixKind === "ai" && !i.edits).length,
    manual: issues.filter((i) => i.fixKind === "manual").length,
    parseErrors: results.filter((r) => r.error).length,
  };
}

function status(i: Issue): string {
  if (i.edits?.length) return i.aiValue ? "fixed (AI)" : "fixed";
  if (i.fixKind === "ai") return "needs --ai";
  if (i.fixKind === "manual") return "manual";
  return "not fixed";
}

export function printConsole(results: FileResult[], root: string, mode: "scan" | "fix"): void {
  for (const r of results) {
    if (r.error) {
      console.log(pc.yellow(`! ${path.relative(root, r.file)}: could not parse (${r.error.split("\n")[0]})`));
    }
    if (r.issues.length === 0) continue;
    console.log(pc.underline(path.relative(root, r.file)));
    for (const i of r.issues) {
      const tag = mode === "fix" ? ` ${pc.dim(`[${status(i)}]`)}` : "";
      const ai = i.aiValue ? pc.cyan(` -> ${i.aiRequest!.attribute}="${i.aiValue.value}"`) : "";
      console.log(`  ${pc.dim(`${i.line}:${i.column}`)} ${pc.red(i.ruleId)} ${pc.dim(`WCAG ${i.wcag}`)} ${i.message}${ai}${tag}`);
    }
    console.log();
  }
  const s = summarize(results);
  const parts = [`${s.issues} issue(s) in ${s.files} file(s)`];
  if (mode === "fix") parts.push(pc.green(`${s.fixed} fixed`));
  if (s.needsAi) parts.push(`${s.needsAi} need --ai`);
  if (s.manual) parts.push(`${s.manual} need a manual fix`);
  if (s.parseErrors) parts.push(pc.yellow(`${s.parseErrors} file(s) could not be parsed`));
  console.log(pc.bold(parts.join(", ")));
}

/** Escapes a table cell. `<` must be escaped or GitHub renders tags like <textarea> as HTML. */
const cell = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Markdown body for the pull request. */
export function markdownReport(results: FileResult[], root: string): string {
  const s = summarize(results);
  const all = results.flatMap((r) => r.issues.map((i) => ({ ...i, rel: path.relative(root, r.file) })));
  const fixed = all.filter((i) => i.edits?.length);
  const open = all.filter((i) => !i.edits?.length);

  const lines = [
    "## Accessibility fixes by A11yFix",
    "",
    `Found **${s.issues}** WCAG issue(s) and fixed **${s.fixed}**.`,
    "",
  ];
  if (fixed.length) {
    lines.push("### Fixed", "", "| File | Rule | WCAG | Change |", "|---|---|---|---|");
    for (const i of fixed) {
      const change = i.aiValue
        ? `${i.aiRequest!.attribute}="${i.aiValue.value}" (AI${i.aiValue.confident ? "" : ", please check"})`
        : i.message;
      lines.push(`| \`${i.rel}:${i.line}\` | ${i.ruleId} | ${i.wcag} | ${cell(change)} |`);
    }
    lines.push("");
  }
  if (open.length) {
    lines.push("### Still open (needs a person)", "", "| File | Rule | WCAG | Issue |", "|---|---|---|---|");
    for (const i of open) lines.push(`| \`${i.rel}:${i.line}\` | ${i.ruleId} | ${i.wcag} | ${cell(i.message)} |`);
    lines.push("");
  }
  if (fixed.some((i) => i.aiValue)) {
    lines.push("> Values marked **AI** were written by Claude from the code around them. Please check that they match what users see.", "");
  }
  return lines.join("\n");
}
