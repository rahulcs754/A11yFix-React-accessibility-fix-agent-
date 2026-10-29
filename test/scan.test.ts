import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyEdits } from "../src/edits.js";
import { applyFixes } from "../src/fix.js";
import { markdownReport, summarize } from "../src/report.js";
import { parseSource, scanDir, scanSource } from "../src/scan.js";

const root = path.join(import.meta.dirname, "fixtures/app");
const ids = (src: string, file = "x.tsx") => scanSource(file, src).map((i) => i.ruleId);

describe("rules", () => {
  it("img-alt: flags img and next/image with no alt, skips alt and decorative", () => {
    expect(ids(`<img src="a.png" />`)).toEqual(["img-alt"]);
    expect(ids(`<Image src="a.png" />`)).toEqual(["img-alt"]);
    expect(ids(`<img src="a.png" alt="" />`)).toEqual([]);
    expect(ids(`<img src="a.png" aria-hidden="true" />`)).toEqual([]);
    expect(ids(`<img {...props} />`)).toEqual([]);
  });

  it("button-name: flags icon-only buttons only", () => {
    expect(ids(`<button><svg /></button>`)).toEqual(["button-name"]);
    expect(ids(`<button><CloseIcon /></button>`)).toEqual(["button-name"]);
    expect(ids(`<button>Save</button>`)).toEqual([]);
    expect(ids(`<button>{label}</button>`)).toEqual([]);
    expect(ids(`<button aria-label="Close"><svg /></button>`)).toEqual([]);
    expect(ids(`<button><Trans id="x" /></button>`)).toEqual([]);
    expect(ids(`<button>{open ? <XIcon /> : <MenuIcon />}</button>`)).toEqual(["button-name"]);
    expect(ids(`<button>{busy && <Spinner />}</button>`)).toEqual([]);
    expect(ids(`<button>{busy ? <SpinnerIcon /> : "Save"}</button>`)).toEqual([]);
  });

  it("click-keyboard: adds only what is missing", () => {
    const [issue] = scanSource("x.tsx", `<div onClick={go}>Hi</div>`);
    expect(issue.ruleId).toBe("click-keyboard");
    const out = applyEdits(`<div onClick={go}>Hi</div>`, issue.edits!).output;
    expect(out).toContain('<div role="button" tabIndex={0} onKeyDown={');
    expect(ids(`<div role="button" tabIndex={0} onClick={go} onKeyDown={k}>Hi</div>`)).toEqual([]);
    expect(ids(`<button onClick={go}>Hi</button>`)).toEqual([]);
    expect(ids(`<Card onClick={go} />`)).toEqual([]);
    expect(ids(`<li onClick={go}><a href="">2</a></li>`)).toEqual([]);
    expect(ids(`<i className="ion-trash" onClick={del}></i>`)).toEqual(["click-keyboard", "button-name"]);
  });

  it("anchor-is-valid: reports <a onClick> without href", () => {
    expect(ids(`<a onClick={go}>x</a>`)).toEqual(["anchor-is-valid"]);
    expect(ids(`<a href="/" onClick={go}>x</a>`)).toEqual([]);
  });

  it("input-label: placeholder, htmlFor, wrapping label, hidden", () => {
    const [p] = scanSource("x.tsx", `<input placeholder="Search" />`);
    expect(p.fixKind).toBe("auto");
    expect(applyEdits(`<input placeholder="Search" />`, p.edits!).output).toBe(`<input aria-label="Search" placeholder="Search" />`);
    expect(ids(`<input name="email" />`)).toEqual(["input-label"]);
    expect(ids(`<><label htmlFor="a">A</label><input id="a" /></>`)).toEqual([]);
    expect(ids(`<label>A <input /></label>`)).toEqual([]);
    expect(ids(`<input type="hidden" />`)).toEqual([]);
    expect(ids(`<input id={id} />`)).toEqual([]);
  });

  it("html-lang and no-positive-tabindex are auto-fixed", () => {
    const src = `<html><body><div tabIndex={2} /></body></html>`;
    const issues = scanSource("x.tsx", src);
    expect(issues.map((i) => i.ruleId)).toEqual(["html-lang", "no-positive-tabindex"]);
    expect(applyEdits(src, issues.flatMap((i) => i.edits!)).output).toBe(`<html lang="en"><body><div tabIndex={0} /></body></html>`);
  });

  it("iframe-title", () => {
    expect(ids(`<iframe src="x" />`)).toEqual(["iframe-title"]);
    expect(ids(`<iframe src="x" title="Demo" />`)).toEqual([]);
  });

  it("keeps type arguments in place", () => {
    const src = `<Image<Props> src="a" />`;
    const [i] = scanSource("x.tsx", src);
    expect(i.aiRequest!.insertAt).toBe(src.indexOf(">") + 1);
  });
});

describe("fixture app", () => {
  it("finds the expected issues", async () => {
    const results = await scanDir(root);
    const found = results.flatMap((r) => r.issues.map((i) => `${path.basename(r.file)}:${i.line}:${i.ruleId}`));
    expect(found).toEqual([
      "layout.tsx:3:html-lang",
      "Header.tsx:7:img-alt",
      "Header.tsx:8:img-alt",
      "Header.tsx:10:button-name",
      "Header.tsx:12:click-keyboard",
      "Header.tsx:14:anchor-is-valid",
      "Header.tsx:16:no-positive-tabindex",
      "SearchForm.jsx:4:input-label",
      "SearchForm.jsx:5:input-label",
      "SearchForm.jsx:13:input-label",
      "SearchForm.jsx:14:iframe-title",
    ]);
  });

  it("fixed output still parses and has no auto-fixable issues left", async () => {
    const results = await scanDir(root);
    const fixed = await applyFixes(results, { dryRun: true });
    expect(fixed.map((f) => path.basename(f.file))).toEqual(["layout.tsx", "Header.tsx", "SearchForm.jsx"]);
    for (const f of fixed) {
      expect(() => parseSource(f.file, f.output)).not.toThrow();
      expect(scanSource(f.file, f.output).filter((i) => i.fixKind === "auto")).toEqual([]);
    }
    expect(summarize(results)).toMatchObject({ issues: 11, fixed: 4, needsAi: 6, manual: 1 });
    const md = markdownReport(results, root);
    expect(md).toContain("| `components/Header.tsx:12` | click-keyboard | 2.1.1 | &lt;div onClick&gt; can't");
    expect(md).not.toMatch(/\| <(div|input|a|textarea)/);
  });
});

describe("link-name and report", () => {
  it("link-name: flags icon-only links, skips links with text or a label", () => {
    expect(ids(`<a href="/gh"><GithubIcon /></a>`)).toEqual(["link-name"]);
    expect(ids(`<Link href="/gh"><svg /></Link>`)).toEqual(["link-name"]);
    expect(ids(`<a href="/gh">GitHub</a>`)).toEqual([]);
    expect(ids(`<a href="/gh" aria-label="GitHub"><GithubIcon /></a>`)).toEqual([]);
    expect(ids(`<a href="/gh">{name}</a>`)).toEqual([]);
  });

  it("shows before/after and an explanation for each fix", () => {
    const source = `<html><div tabIndex={2}>Skip</div></html>`;
    const results = [{ file: "/r/a.tsx", source, issues: scanSource("a.tsx", source) }];
    const md = markdownReport(results, "/r");
    expect(md).toContain("Before / after");
    expect(md).toContain('```tsx\n<html lang="en">\n```');
    expect(md).toContain("```tsx\n<div tabIndex={0}>\n```");
    expect(md).toContain("Screen readers need the page language");
  });

  it("adds axe-core results with a contrast suggestion", () => {
    const md = markdownReport([], "/r", [
      {
        url: "http://localhost:3000/",
        axeRule: "color-contrast",
        impact: "serious",
        help: "Elements must meet minimum color contrast ratio thresholds",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.11/color-contrast",
        html: '<p class="muted">Hi</p>',
        selector: ".muted",
        source: { file: "/r/a.tsx", line: 3, how: "search" },
        contrast: { fg: "#aaaaaa", bg: "#ffffff", ratio: 2.32, expected: 4.5, suggestedFg: "#747474" },
      },
    ]);
    expect(md).toContain("Found on the running page (axe-core)");
    expect(md).toContain("`a.tsx:3`");
    expect(md).toContain("Closest passing text color: #747474");
  });
});
