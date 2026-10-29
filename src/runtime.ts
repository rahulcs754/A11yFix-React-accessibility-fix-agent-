import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { listFiles } from "./scan.js";
import type { Issue } from "./types.js";

/** axe-core rules for the MVP error types, and the static rule that fixes each. */
export const AXE_RULES: Record<string, string | undefined> = {
  "color-contrast": undefined,
  "image-alt": "img-alt",
  "button-name": "button-name",
  "link-name": "link-name",
  label: "input-label",
  "select-name": "input-label",
  "html-has-lang": "html-lang",
  "frame-title": "iframe-title",
};

export interface RuntimeIssue {
  url: string;
  axeRule: string;
  /** Matching static rule id, when the source scan can fix it. */
  ruleId?: string;
  impact: string;
  help: string;
  helpUrl: string;
  html: string;
  selector: string;
  component?: string;
  /** Best guess of where this element is written. */
  source?: { file: string; line: number; how: "react-debug-source" | "search" | "static-match" };
  contrast?: { fg: string; bg: string; ratio: number; expected: number; suggestedFg?: string };
}

interface PageNode {
  rule: string;
  impact: string;
  help: string;
  helpUrl: string;
  html: string;
  selector: string;
  component?: string;
  debugSource?: { fileName: string; lineNumber: number };
  contrast?: { fgColor: string; bgColor: string; contrastRatio: number; expectedContrastRatio: string };
}

/**
 * Load each URL in headless Chromium, run axe-core, and map every violation back
 * to a JSX file and line under `root`.
 */
export async function runtimeScan(urls: string[], root: string): Promise<RuntimeIssue[]> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is not installed. Run `npm i -D playwright && npx playwright install chromium`.");
  }
  const require = createRequire(import.meta.url);
  const axePath = require.resolve("axe-core/axe.min.js");
  const browser = await chromium.launch({ executablePath: process.env.A11YFIX_CHROMIUM_PATH || undefined });
  const files = await loadSources(root);
  const out: RuntimeIssue[] = [];
  try {
    for (const url of urls) {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.addScriptTag({ path: axePath });
      const nodes = (await page.evaluate(`(${IN_PAGE})(${JSON.stringify(Object.keys(AXE_RULES))})`)) as PageNode[];
      await page.close();
      for (const n of nodes) out.push(toIssue(url, n, files));
    }
  } finally {
    await browser.close();
  }
  return out;
}

/**
 * Runs inside the page: axe-core, then React fiber data for each failing node.
 * Kept as plain JS text so bundlers can't inject helpers into it.
 * `_debugSource` exists in React 18 dev builds and gives the exact JSX file and line.
 */
const IN_PAGE = `async (ruleIds) => {
  const res = await window.axe.run(document, { runOnly: { type: "rule", values: ruleIds } });
  const nodes = [];
  for (const v of res.violations) {
    for (const n of v.nodes) {
      const selector = String(n.target[0]);
      const node = { rule: v.id, impact: n.impact || v.impact, help: v.help, helpUrl: v.helpUrl, html: n.html, selector };
      let el = null;
      try { el = document.querySelector(selector); } catch {}
      const key = el && Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      let fiber = key ? el[key] : null;
      while (fiber) {
        if (!node.debugSource && fiber._debugSource) node.debugSource = fiber._debugSource;
        if (!node.component && typeof fiber.type === "function") node.component = fiber.type.displayName || fiber.type.name;
        if (node.debugSource && node.component) break;
        fiber = fiber.return;
      }
      const data = n.any && n.any[0] && n.any[0].data;
      if (v.id === "color-contrast" && data && data.fgColor) node.contrast = data;
      nodes.push(node);
    }
  }
  return nodes;
}`;

interface SourceFile {
  file: string;
  text: string;
  lines: string[];
}

async function loadSources(root: string): Promise<SourceFile[]> {
  const files = await listFiles(root);
  return Promise.all(
    files.map(async (file) => {
      const text = await readFile(file, "utf8");
      return { file, text, lines: text.split("\n") };
    }),
  );
}

function toIssue(url: string, n: PageNode, files: SourceFile[]): RuntimeIssue {
  const issue: RuntimeIssue = {
    url,
    axeRule: n.rule,
    ruleId: AXE_RULES[n.rule],
    impact: n.impact,
    help: n.help,
    helpUrl: n.helpUrl,
    html: n.html,
    selector: n.selector,
    component: n.component,
  };
  if (n.debugSource) {
    const rel = path.relative(process.cwd(), n.debugSource.fileName);
    issue.source = { file: rel.startsWith("..") ? n.debugSource.fileName : rel, line: n.debugSource.lineNumber, how: "react-debug-source" };
  } else {
    const hit = findInSource(n.html, n.component, files);
    if (hit) issue.source = { ...hit, how: "search" };
  }
  if (n.contrast) {
    const expected = parseFloat(n.contrast.expectedContrastRatio);
    issue.contrast = {
      fg: n.contrast.fgColor,
      bg: n.contrast.bgColor,
      ratio: n.contrast.contrastRatio,
      expected,
      suggestedFg: suggestColor(n.contrast.fgColor, n.contrast.bgColor, expected),
    };
  }
  return issue;
}

/**
 * Find where an element from the page is written in JSX, using its tag and its
 * most specific attributes (id, src, href, class, text). Files that define the
 * React component it was rendered by win ties.
 */
export function findInSource(
  html: string,
  component: string | undefined,
  files: SourceFile[],
): { file: string; line: number } | undefined {
  const tag = /^<([a-zA-Z0-9-]+)/.exec(html)?.[1];
  if (!tag) return undefined;
  const attr = (name: string) => new RegExp(`\\s${name}="([^"]+)"`).exec(html)?.[1];
  const needles: string[] = [];
  const id = attr("id");
  if (id) needles.push(`id="${id}"`);
  const src = attr("src");
  if (src && !src.startsWith("data:")) needles.push(src.replace(/^https?:\/\/[^/]+/, "").split("?")[0]!);
  const href = attr("href");
  if (href) needles.push(`"${href}"`);
  const cls = attr("class");
  if (cls) needles.push(...cls.split(/\s+/).filter((c) => c.length > 3).slice(0, 3));
  const text = /^<[^>]*>([^<]{3,})</.exec(html)?.[1]?.trim();
  if (text) needles.push(text);

  let best: { file: string; line: number; score: number } | undefined;
  for (const f of files) {
    const definesComponent = component ? new RegExp(`(function|const|class)\\s+${component}\\b`).test(f.text) : false;
    f.lines.forEach((line, i) => {
      if (!line.includes(`<${tag}`) && !(tag === "img" && line.includes("<Image")) && !(tag === "a" && line.includes("<Link"))) {
        return;
      }
      // Look at the tag line plus a few lines after it (multi-line props).
      const window = f.lines.slice(i, i + 6).join("\n");
      let score = needles.filter((nd) => window.includes(nd)).length * 2;
      if (definesComponent) score += 1;
      if (score > 0 && (!best || score > best.score)) best = { file: f.file, line: i + 1, score };
    });
  }
  return best && { file: best.file, line: best.line };
}

/**
 * For page errors we could not place (e.g. a bare `<button></button>`), use the
 * source scan: if exactly one source issue has the same rule and tag, it is that one.
 */
export function linkToStaticIssues(runtime: RuntimeIssue[], issues: Issue[]): void {
  for (const r of runtime) {
    if (r.source || !r.ruleId) continue;
    const tag = /^<([a-zA-Z0-9-]+)/.exec(r.html)?.[1];
    if (!tag) continue;
    const tags = tag === "img" ? ["<img", "<Image"] : tag === "a" ? ["<a", "<Link"] : [`<${tag}`];
    const matches = issues.filter(
      (i) => i.ruleId === r.ruleId && tags.some((t) => i.snippet.startsWith(t) && /[\s/>]/.test(i.snippet[t.length] ?? "")),
    );
    if (matches.length === 1) r.source = { file: matches[0]!.file, line: matches[0]!.line, how: "static-match" };
  }
}

// ---- color contrast helpers ----

function parseHex(hex: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contrastRatio(a: string, b: string): number | undefined {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return undefined;
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (l1! + 0.05) / (l2! + 0.05);
}

const toHex = (c: [number, number, number]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * Closest text color that passes: move the foreground toward black (or white on
 * dark backgrounds) in small steps until the ratio is high enough.
 */
export function suggestColor(fg: string, bg: string, expected: number): string | undefined {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return undefined;
  const target: [number, number, number] = luminance(b) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const c = f.map((v, i) => v + (target[i]! - v) * t) as [number, number, number];
    const hex = toHex(c);
    if ((contrastRatio(hex, bg) ?? 0) >= expected) return hex;
  }
  return undefined;
}
