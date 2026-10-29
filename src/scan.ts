import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse, type ParserPlugin } from "@babel/parser";
import type { File } from "@babel/types";
import { attrString, elementName, getAttr, walkJsx } from "./jsx.js";
import { rules as allRules } from "./rules/index.js";
import type { Issue, Rule, ScanOptions } from "./types.js";

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".turbo", ".vercel", "storybook-static",
]);
const EXTENSIONS = new Set([".jsx", ".tsx", ".js"]);

export const DEFAULT_OPTIONS: ScanOptions = { lang: "en" };

export async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) await walk(path.join(dir, entry.name));
      } else if (EXTENSIONS.has(path.extname(entry.name)) && !/\.(test|spec|stories)\.[jt]sx?$/.test(entry.name)) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  await walk(root);
  return out.sort();
}

export function parseSource(file: string, source: string): File {
  const plugins: ParserPlugin[] = file.endsWith(".tsx") ? ["jsx", "typescript"] : ["jsx"];
  return parse(source, { sourceType: "module", plugins, sourceFilename: file });
}

/** Scans one file's source. Throws on parse errors. */
export function scanSource(
  file: string,
  source: string,
  options: ScanOptions = DEFAULT_OPTIONS,
  rules: Rule[] = allRules,
): Issue[] {
  // Cheap skip for plain .js files with no JSX.
  if (!/<[A-Za-z]/.test(source)) return [];
  const ast = parseSource(file, source);

  const labelledIds = new Set<string>();
  walkJsx(ast, (el) => {
    if (elementName(el.openingElement) !== "label") return;
    const id = attrString(getAttr(el.openingElement, "htmlFor"));
    if (id) labelledIds.add(id);
  });

  const issues: Issue[] = [];
  walkJsx(ast, (element, ancestors) => {
    const opening = element.openingElement;
    const name = elementName(opening);
    if (!name) return;
    const ctx = { file, source, element, opening, name, ancestors, labelledIds, options };
    for (const rule of rules) {
      for (const found of rule.check(ctx)) {
        const snippet = source.slice(opening.start!, opening.end!);
        issues.push({
          ...found,
          file,
          line: opening.loc!.start.line,
          column: opening.loc!.start.column + 1,
          snippet: snippet.length > 240 ? `${snippet.slice(0, 237)}...` : snippet,
          range: { start: opening.start!, end: opening.end! },
        });
      }
    }
  });
  return issues;
}

export interface FileResult {
  file: string;
  source: string;
  issues: Issue[];
  error?: string;
}

export async function scanDir(root: string, options: ScanOptions = DEFAULT_OPTIONS): Promise<FileResult[]> {
  const results: FileResult[] = [];
  for (const file of await listFiles(root)) {
    const source = await readFile(file, "utf8");
    try {
      results.push({ file, source, issues: scanSource(file, source, options) });
    } catch (err) {
      results.push({ file, source, issues: [], error: (err as Error).message });
    }
  }
  return results;
}
