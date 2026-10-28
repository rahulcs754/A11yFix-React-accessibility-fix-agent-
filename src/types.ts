import type { JSXElement, JSXOpeningElement } from "@babel/types";

/** A text change. Offsets are into the original file source. */
export interface Edit {
  start: number;
  end: number;
  text: string;
}

export type FixKind =
  /** Safe, deterministic fix applied without AI. */
  | "auto"
  /** Fix needs human-quality text (alt text, labels). Filled by Claude when --ai is on. */
  | "ai"
  /** We only report it; a person must decide. */
  | "manual";

export interface Issue {
  ruleId: string;
  /** WCAG 2.2 success criterion, e.g. "1.1.1". */
  wcag: string;
  message: string;
  file: string;
  line: number;
  column: number;
  fixKind: FixKind;
  /** Present when fixKind is "auto", or after AI filled it in. */
  edits?: Edit[];
  /** For "ai" fixes: which attribute to add, and where to insert it. */
  aiRequest?: AiRequest;
  /** Set after Claude wrote the value, so reports can ask for a human check. */
  aiValue?: { value: string; confident: boolean; explanation?: string };
  /** Short source snippet for reports and AI context. */
  snippet: string;
  /** Offsets of the whole opening tag, so reports can show it before and after the fix. */
  range?: { start: number; end: number };
}

export interface AiRequest {
  attribute: string;
  insertAt: number;
  /** What the value should describe, shown to the model. */
  hint: string;
}

export interface RuleContext {
  file: string;
  source: string;
  element: JSXElement;
  opening: JSXOpeningElement;
  /** Lower-cased DOM tag, or the component name as written (e.g. "Image"). */
  name: string;
  ancestors: JSXElement[];
  /** ids referenced by <label htmlFor="..."> anywhere in this file. */
  labelledIds: Set<string>;
  options: ScanOptions;
}

export interface Rule {
  id: string;
  wcag: string;
  check(ctx: RuleContext): Omit<Issue, "file" | "line" | "column" | "snippet">[];
}

export interface ScanOptions {
  /** Language used for <html lang>. */
  lang: string;
}
