import type { JSXOpeningElement } from "@babel/types";
import type { Edit } from "./types.js";

/** Offset right after the tag name (and any type arguments), where new attributes go. */
export function attrInsertPoint(opening: JSXOpeningElement): number {
  const typeArgs = (opening as { typeArguments?: { end?: number | null } | null }).typeArguments;
  return typeArgs?.end ?? opening.name.end!;
}

/** `name="value"`, falling back to `name={"value"}` when the value has quotes or braces. */
export function jsxAttr(name: string, value: string): string {
  return /["{}<>\\\n]/.test(value) ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
}

export function insert(at: number, text: string): Edit {
  return { start: at, end: at, text: ` ${text}` };
}

/**
 * Applies edits to source. Edits at the same offset keep their given order.
 * An edit that overlaps an earlier replacement is skipped and returned in `skipped`.
 */
export function applyEdits(source: string, edits: Edit[]): { output: string; skipped: Edit[] } {
  const sorted = edits
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.start - b.e.start || a.i - b.i)
    .map(({ e }) => e);
  let out = "";
  let cursor = 0;
  const skipped: Edit[] = [];
  for (const e of sorted) {
    if (e.start < cursor) {
      skipped.push(e);
      continue;
    }
    out += source.slice(cursor, e.start) + e.text;
    cursor = e.end;
  }
  return { output: out + source.slice(cursor), skipped };
}
