import { attrInsertPoint } from "../edits.js";
import { attrString, getAttr, hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

/** `<iframe>` needs a title. WCAG 4.1.2 Name, Role, Value. */
export const iframeTitle: Rule = {
  id: "iframe-title",
  wcag: "4.1.2",
  check({ name, opening }) {
    if (name !== "iframe" || hasSpread(opening)) return [];
    if (hasAttr(opening, "title", "aria-label", "aria-labelledby")) return [];
    if (attrString(getAttr(opening, "aria-hidden")) === "true") return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: "<iframe> has no title.",
        fixKind: "ai",
        aiRequest: {
          attribute: "title",
          insertAt: attrInsertPoint(opening),
          hint: 'A short title for the embedded content, e.g. "Product demo video".',
        },
      },
    ];
  },
};
