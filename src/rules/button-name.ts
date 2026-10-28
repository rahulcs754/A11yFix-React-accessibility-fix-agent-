import { attrInsertPoint } from "../edits.js";
import { hasAccessibleContent, hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

/** Icon-only `<button>` needs an accessible name. WCAG 4.1.2 Name, Role, Value. */
export const buttonName: Rule = {
  id: "button-name",
  wcag: "4.1.2",
  check({ name, opening, element }) {
    if (name !== "button") return [];
    if (hasSpread(opening) || hasAttr(opening, "aria-label", "aria-labelledby", "title")) return [];
    if (hasAccessibleContent(element)) return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: "<button> has no text, so screen readers can't name it.",
        fixKind: "ai",
        aiRequest: {
          attribute: "aria-label",
          insertAt: attrInsertPoint(opening),
          hint: "A short label for what the button does, e.g. \"Close dialog\" or \"Open menu\".",
        },
      },
    ];
  },
};
