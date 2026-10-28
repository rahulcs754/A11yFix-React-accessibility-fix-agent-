import { attrInsertPoint, insert, jsxAttr } from "../edits.js";
import { hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

/** `<html>` needs a lang. WCAG 3.1.1 Language of Page. Common in Next.js app/layout.tsx. */
export const htmlLang: Rule = {
  id: "html-lang",
  wcag: "3.1.1",
  check({ name, opening, options }) {
    if (name !== "html" || hasSpread(opening) || hasAttr(opening, "lang")) return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: `<html> has no lang. Adding lang="${options.lang}".`,
        fixKind: "auto",
        edits: [insert(attrInsertPoint(opening), jsxAttr("lang", options.lang))],
      },
    ];
  },
};
