import { describe, expect, it } from "vitest";
import { contrastRatio, findInSource, linkToStaticIssues, type RuntimeIssue, suggestColor } from "../src/runtime.js";
import { scanSource } from "../src/scan.js";

const text = `export function Card() {
  return (
    <div>
      <img src="/logo.png" />
      <p className="muted-text">Low contrast</p>
      <a href="https://github.com/acme">
        <GithubIcon />
      </a>
    </div>
  );
}`;
const files = [{ file: "Card.tsx", text, lines: text.split("\n") }];

describe("color contrast", () => {
  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("suggests the closest passing text color", () => {
    const light = suggestColor("#aaaaaa", "#ffffff", 4.5)!;
    expect(contrastRatio(light, "#ffffff")!).toBeGreaterThanOrEqual(4.5);
    const dark = suggestColor("#444444", "#111111", 4.5)!;
    expect(contrastRatio(dark, "#111111")!).toBeGreaterThanOrEqual(4.5);
  });
});

describe("findInSource", () => {
  it("maps page elements back to the JSX line", () => {
    expect(findInSource('<img src="http://localhost:3000/logo.png">', undefined, files)).toEqual({ file: "Card.tsx", line: 4 });
    expect(findInSource('<p class="muted-text">Low contrast</p>', "Card", files)).toEqual({ file: "Card.tsx", line: 5 });
    expect(findInSource('<a href="https://github.com/acme"><svg></svg></a>', undefined, files)).toEqual({ file: "Card.tsx", line: 6 });
  });

  it("returns undefined when nothing matches", () => {
    expect(findInSource('<button class="nope"></button>', undefined, files)).toBeUndefined();
  });
});

describe("linkToStaticIssues", () => {
  it("places bare elements using the one matching source issue", () => {
    const issues = scanSource("Page.tsx", `<html><body><button><XIcon /></button><button>Ok</button></body></html>`);
    const base = { url: "/", impact: "serious", help: "", helpUrl: "", selector: "" };
    const runtime: RuntimeIssue[] = [
      { ...base, axeRule: "button-name", ruleId: "button-name", html: "<button></button>" },
      { ...base, axeRule: "html-has-lang", ruleId: "html-lang", html: "<html>" },
    ];
    linkToStaticIssues(runtime, issues);
    expect(runtime[0]!.source).toEqual({ file: "Page.tsx", line: 1, how: "static-match" });
    expect(runtime[1]!.source?.how).toBe("static-match");
  });
});
