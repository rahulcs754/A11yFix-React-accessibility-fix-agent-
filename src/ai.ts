import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { insert, jsxAttr } from "./edits.js";
import type { Issue } from "./types.js";

export const MODEL = "claude-opus-5-5";

const FixesSchema = z.object({
  fixes: z.array(
    z.object({
      id: z.number().int(),
      value: z.string(),
      /** False when the code gives too little context to be sure. Shown in the report. */
      confident: z.boolean(),
      /** One sentence for the PR on why this value fits. */
      explanation: z.string(),
    }),
  ),
});

const SYSTEM = `You fix accessibility issues in React code by writing attribute values: alt text, aria-label, and iframe titles.

Rules:
- Base each value on the code: file and component names, src paths, nearby text, props, handlers, and icon names.
- Keep it short and plain (usually 1 to 5 words). Say what the thing is or does, not how it looks. Don't start alt text with "Image of".
- Use the same language as the visible text in the file.
- For alt on a purely decorative image, return "". Never return "" for aria-label or title.
- Set confident to false when the code gives too little context to be sure. Still give your best value.
- Give a one-sentence explanation of why the value fits, based on what you saw in the code.
- Return exactly one fix for every issue id you are given.`;

/**
 * Fills in `edits` for every "ai" issue in one file, with one Claude call.
 * Issues the model skips stay unfixed. Returns the issues that were filled.
 */
export async function aiFillFile(client: Anthropic, file: string, source: string, issues: Issue[]): Promise<Issue[]> {
  const pending = issues.filter((i) => i.fixKind === "ai" && i.aiRequest && !i.edits);
  if (pending.length === 0) return [];

  const list = pending
    .map((i, id) => `#${id} line ${i.line}, add ${i.aiRequest!.attribute}: ${i.aiRequest!.hint}\n${i.snippet}`)
    .join("\n\n");

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(FixesSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `File: ${file}\n\n<source>\n${source}\n</source>\n\nIssues:\n\n${list}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return [];

  const filled: Issue[] = [];
  for (const fix of response.parsed_output.fixes) {
    const issue = pending[fix.id];
    if (!issue) continue;
    const { attribute, insertAt } = issue.aiRequest!;
    const value = fix.value.trim();
    if (!value && attribute !== "alt") continue;
    issue.edits = [insert(insertAt, jsxAttr(attribute, value))];
    issue.aiValue = { value, confident: fix.confident, explanation: fix.explanation };
    filled.push(issue);
  }
  return filled;
}
