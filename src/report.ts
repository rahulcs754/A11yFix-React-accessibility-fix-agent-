import path from "node:path";
import pc from "picocolors";
import { applyEdits } from "./edits.js";
import { EXPLANATIONS } from "./explain.js";
import type { RuntimeIssue } from "./runtime.js";
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

export function printConsole(results: FileResult[], root: string, mode: "scan" | "fix", runtime: RuntimeIssue[] = []): void {
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
  if (runtime.length) {
    console.log(pc.underline("Running page (axe-core)"));
    for (const r of runtime) {
      const where = r.source ? path.relative(root, path.resolve(r.source.file)) + `:${r.source.line}` : pc.dim("source not found");
      const c = r.contrast;
      const extra = c
        ? ` ${c.fg} on ${c.bg} is ${c.ratio}:1, needs ${c.expected}:1` + (c.suggestedFg ? pc.cyan(` -> try ${c.suggestedFg}`) : "")
        : "";
      console.log(`  ${pc.red(r.axeRule)} ${r.help}${extra} ${pc.dim(r.url)} ${where}`);
    }
    console.log();
  }
  const s = summarize(results);
  const parts = [`${s.issues} issue(s) in ${s.files} file(s)`];
  if (runtime.length) parts.push(`${runtime.length} on the running page`);
  if (mode === "fix") parts.push(pc.green(`${s.fixed} fixed`));
  if (s.needsAi) parts.push(`${s.needsAi} need --ai`);
  if (s.manual) parts.push(`${s.manual} need a manual fix`);
  if (s.parseErrors) parts.push(pc.yellow(`${s.parseErrors} file(s) could not be parsed`));
  console.log(pc.bold(parts.join(", ")));
}

/** Escapes a table cell. `<` must be escaped or GitHub renders tags like <textarea> as HTML. */
const cell = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The opening tag after this issue's own edits, for before/after views. */
export function tagAfter(issue: Issue, source: string): string | undefined {
  if (!issue.edits?.length || !issue.range) return undefined;
  const { start, end } = issue.range;
  const local = issue.edits
    .filter((e) => e.start >= start && e.end <= end)
    .map((e) => ({ ...e, start: e.start - start, end: e.end - start }));
  return applyEdits(source.slice(start, end), local).output;
}

const fence = (code: string) => "```tsx\n" + (code.length > 600 ? `${code.slice(0, 597)}...` : code) + "\n```";

function explanation(i: Issue): string {
  const parts = [EXPLANATIONS[i.ruleId] ?? ""];
  if (i.aiValue?.explanation) parts.push(`Claude: ${i.aiValue.explanation}`);
  return parts.filter(Boolean).join(" ");
}

/** Markdown body for the pull request: summary, before/after for every fix, open issues, and axe results. */
export function markdownReport(results: FileResult[], root: string, runtime: RuntimeIssue[] = [], applied = true): string {
  const s = summarize(results);
  const all = results.flatMap((r) => r.issues.map((i) => ({ ...i, rel: path.relative(root, r.file), source: r.source })));
  const fixed = all.filter((i) => i.edits?.length);
  const open = all.filter((i) => !i.edits?.length);

  const lines = [
    "## Accessibility fixes by A11yFix",
    "",
    `Found **${s.issues}** WCAG issue(s) in source and ${applied ? "fixed" : "can fix"} **${s.fixed}**.` +
      (runtime.length ? ` axe-core found **${runtime.length}** on the running page.` : ""),
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
    lines.push("", "<details><summary>Before / after for each fix</summary>", "");
    for (const i of fixed) {
      const { source } = i;
      lines.push(`#### \`${i.rel}:${i.line}\` ${i.ruleId} (WCAG ${i.wcag})`, "");
      const why = explanation(i);
      if (why) lines.push(why, "");
      const after = tagAfter(i, source);
      if (i.range && after !== undefined) {
        lines.push("Before:", fence(source.slice(i.range.start, i.range.end)), "After:", fence(after), "");
      }
    }
    lines.push("</details>", "");
  }
  if (open.length) {
    lines.push("### Still open (needs a person)", "", "| File | Rule | WCAG | Issue |", "|---|---|---|---|");
    for (const i of open) lines.push(`| \`${i.rel}:${i.line}\` | ${i.ruleId} | ${i.wcag} | ${cell(i.message)} |`);
    lines.push("");
  }
  if (runtime.length) {
    lines.push("### Found on the running page (axe-core)", "", "| Rule | Page | Element | Source | Note |", "|---|---|---|---|---|");
    for (const r of runtime) {
      const where = r.source ? `\`${path.relative(root, path.resolve(r.source.file))}:${r.source.line}\`` : "not found";
      const c = r.contrast;
      const note = c
        ? `${c.fg} on ${c.bg} is ${c.ratio}:1, needs ${c.expected}:1` + (c.suggestedFg ? `. Closest passing text color: ${c.suggestedFg}` : "")
        : r.ruleId
          ? `source rule: ${r.ruleId}`
          : "";
      lines.push(`| [${r.axeRule}](${r.helpUrl}) | ${cell(r.url)} | ${cell(r.html.slice(0, 80))} | ${where} | ${cell(note)} |`);
    }
    lines.push("");
    if (runtime.some((r) => r.contrast)) {
      lines.push("> Colors are not changed automatically, because that is a design decision. The suggested color is the closest one that passes.", "");
    }
  }
  if (fixed.some((i) => i.aiValue)) {
    lines.push("> Values marked **AI** were written by Claude from the code around them. Please check that they match what users see.", "");
  }
  return lines.join("\n");
}
