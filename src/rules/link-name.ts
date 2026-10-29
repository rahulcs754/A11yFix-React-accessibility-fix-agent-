import { attrInsertPoint } from "../edits.js";
import { attrString, getAttr, hasAccessibleContent, hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

/** `<a href>` / Next.js `<Link>` with no text (e.g. icon-only links). WCAG 2.4.4 Link Purpose. */
export const linkName: Rule = {
  id: "link-name",
  wcag: "2.4.4",
  check({ name, opening, element }) {
    if (name !== "a" && name !== "Link") return [];
    if (hasSpread(opening) || !hasAttr(opening, "href")) return [];
    if (hasAttr(opening, "aria-label", "aria-labelledby", "title")) return [];
    if (attrString(getAttr(opening, "aria-hidden")) === "true") return [];
    if (hasAccessibleContent(element)) return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: `<${name}> link has no text, so screen readers can't say where it goes.`,
        fixKind: "ai",
        aiRequest: {
          attribute: "aria-label",
          insertAt: attrInsertPoint(opening),
          hint: 'A short label for where the link goes, e.g. "GitHub profile". Use the href and icon name as clues.',
        },
      },
    ];
  },
};
