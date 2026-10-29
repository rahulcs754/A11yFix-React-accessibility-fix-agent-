#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { Command } from "commander";
import pc from "picocolors";
import { aiFillFile } from "./ai.js";
import { applyFixes } from "./fix.js";
import { openPullRequest } from "./pr.js";
import { markdownReport, printConsole, summarize } from "./report.js";
import { linkToStaticIssues, runtimeScan, type RuntimeIssue } from "./runtime.js";
import { scanDir } from "./scan.js";

const urlsHelp = "also load these URLs in Chromium and run axe-core (contrast, alt, labels, names, lang)";

const program = new Command()
  .name("a11yfix")
  .description("Find WCAG accessibility errors in React code, fix them, and open a PR.")
  .version("0.1.0");

program
  .command("scan")
  .description("Report issues without changing files. Exits with code 1 when issues are found.")
  .argument("[dir]", "folder to scan", ".")
  .option("--json", "print JSON instead of text")
  .option("--lang <lang>", "language for <html lang>", "en")
  .option("-u, --url <urls...>", urlsHelp)
  .option("--report <file>", "also write the Markdown report to a file")
  .action(async (dir: string, opts: { json?: boolean; lang: string; url?: string[]; report?: string }) => {
    const root = path.resolve(dir);
    const results = await scanDir(root, { lang: opts.lang });
    const runtime = opts.url?.length ? await runtimeScan(opts.url, root) : [];
    linkToStaticIssues(runtime, results.flatMap((r) => r.issues));
    if (opts.json) printJson(results, root, runtime);
    else printConsole(results, root, "scan", runtime);
    if (opts.report) await writeFile(opts.report, markdownReport(results, root, runtime, false));
    if (summarize(results).issues > 0 || runtime.length > 0) process.exitCode = 1;
  });

program
  .command("fix")
  .description("Apply safe fixes. Add --ai for alt text and labels, --pr to open a pull request.")
  .argument("[dir]", "folder to fix", ".")
  .option("--ai", "use Claude to write alt text, aria-labels and titles (needs ANTHROPIC_API_KEY)")
  .option("--pr", "commit the fixes on a new branch and open a PR with gh")
  .option("--base <branch>", "base branch for the PR")
  .option("--dry-run", "show what would change without writing files")
  .option("--json", "print JSON instead of text")
  .option("--lang <lang>", "language for <html lang>", "en")
  .option("-u, --url <urls...>", urlsHelp)
  .option("--report <file>", "also write the Markdown report to a file")
  .action(async (dir: string, opts: FixOptions) => {
    const root = path.resolve(dir);
    const results = await scanDir(root, { lang: opts.lang });
    const runtime = opts.url?.length ? await runtimeScan(opts.url, root) : [];
    linkToStaticIssues(runtime, results.flatMap((r) => r.issues));

    if (opts.ai) {
      const client = new Anthropic();
      const withAi = results.filter((r) => r.issues.some((i) => i.fixKind === "ai"));
      for (const [n, r] of withAi.entries()) {
        if (!opts.json) process.stderr.write(pc.dim(`AI ${n + 1}/${withAi.length} ${path.relative(root, r.file)}\n`));
        try {
          await aiFillFile(client, path.relative(root, r.file), r.source, r.issues);
        } catch (err) {
          process.stderr.write(pc.yellow(`  AI fill failed: ${(err as Error).message}\n`));
        }
      }
    }

    const fixed = await applyFixes(results, { dryRun: opts.dryRun });
    if (opts.json) printJson(results, root, runtime);
    else {
      printConsole(results, root, "fix", runtime);
      if (opts.dryRun) console.log(pc.dim("Dry run: no files were changed."));
    }

    if (opts.report) await writeFile(opts.report, markdownReport(results, root, runtime, !opts.dryRun));

    if (opts.pr && !opts.dryRun) {
      if (fixed.length === 0) {
        console.log("Nothing was fixed, so no PR was opened.");
        return;
      }
      const s = summarize(results);
      const url = openPullRequest({
        cwd: root,
        files: fixed.map((f) => f.file),
        title: `fix(a11y): fix ${s.fixed} accessibility issue${s.fixed === 1 ? "" : "s"}`,
        body: markdownReport(results, root, runtime),
        base: opts.base,
      });
      console.log(pc.green(`PR opened: ${url}`));
    }
  });

interface FixOptions {
  ai?: boolean;
  pr?: boolean;
  base?: string;
  dryRun?: boolean;
  json?: boolean;
  lang: string;
  url?: string[];
  report?: string;
}

function printJson(results: Awaited<ReturnType<typeof scanDir>>, root: string, runtime: RuntimeIssue[] = []): void {
  const issues = results.flatMap((r) =>
    r.issues.map(({ edits, aiRequest, range, ...i }) => ({ ...i, file: path.relative(root, r.file), fixed: Boolean(edits?.length) })),
  );
  console.log(JSON.stringify({ summary: summarize(results), issues, runtime }, null, 2));
}

program.parseAsync().catch((err: Error) => {
  console.error(pc.red(err.message));
  process.exit(2);
});
