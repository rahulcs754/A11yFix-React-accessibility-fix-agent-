import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { aiFillFile, MODEL } from "../src/ai.js";
import { applyEdits } from "../src/edits.js";
import { scanSource } from "../src/scan.js";

const src = `export const A = () => (
  <div>
    <img src="/team.jpg" />
    <button onClick={close}><XIcon /></button>
    <img src="/bg.png" />
  </div>
);`;

function stubClient(fixes: unknown) {
  const parse = vi.fn().mockResolvedValue({ stop_reason: "end_turn", parsed_output: { fixes } });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

describe("aiFillFile", () => {
  it("sends one request per file and inserts the returned values", async () => {
    const issues = scanSource("A.tsx", src);
    const { client, parse } = stubClient([
      { id: 0, value: "Our team at the 2025 offsite", confident: true },
      { id: 1, value: "Close dialog", confident: true, explanation: "The handler is named close." },
      { id: 2, value: "", confident: false },
    ]);
    const filled = await aiFillFile(client, "A.tsx", src, issues);

    expect(parse).toHaveBeenCalledOnce();
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe(MODEL);
    expect(req.fallbacks).toBe("default");
    expect(req.messages[0].content).toContain("#1 line 4, add aria-label");

    expect(filled).toHaveLength(3);
    const out = applyEdits(src, issues.flatMap((i) => i.edits ?? [])).output;
    expect(out).toContain(`<img alt="Our team at the 2025 offsite" src="/team.jpg" />`);
    expect(out).toContain(`<button aria-label="Close dialog" onClick={close}>`);
    // Decorative image gets alt="".
    expect(out).toContain(`<img alt="" src="/bg.png" />`);
    expect(scanSource("A.tsx", out)).toEqual([]);
    expect(issues[1].aiValue?.explanation).toBe("The handler is named close.");
  });

  it("never inserts an empty aria-label, and ignores unknown ids", async () => {
    const issues = scanSource("A.tsx", src);
    const { client } = stubClient([
      { id: 1, value: "  ", confident: true },
      { id: 9, value: "nope", confident: true },
    ]);
    expect(await aiFillFile(client, "A.tsx", src, issues)).toEqual([]);
    expect(issues.every((i) => !i.edits)).toBe(true);
  });

  it("leaves issues open on refusal", async () => {
    const issues = scanSource("A.tsx", src);
    const parse = vi.fn().mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    const client = { beta: { messages: { parse } } } as unknown as Anthropic;
    expect(await aiFillFile(client, "A.tsx", src, issues)).toEqual([]);
  });

  it("escapes values with quotes", async () => {
    const issues = scanSource("A.tsx", src);
    const { client } = stubClient([{ id: 0, value: 'Sign reading "Open"', confident: true }]);
    await aiFillFile(client, "A.tsx", src, issues);
    expect(applyEdits(src, issues[0].edits!).output).toContain(`<img alt={"Sign reading \\"Open\\""} src="/team.jpg" />`);
  });
});
