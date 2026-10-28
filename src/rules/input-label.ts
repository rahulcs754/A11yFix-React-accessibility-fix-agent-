import { attrInsertPoint, insert, jsxAttr } from "../edits.js";
import { attrString, elementName, getAttr, hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

const NO_LABEL_NEEDED = new Set(["hidden", "submit", "button", "reset", "image"]);

/** Form fields need a label. WCAG 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value. */
export const inputLabel: Rule = {
  id: "input-label",
  wcag: "1.3.1",
  check({ name, opening, ancestors, labelledIds }) {
    if (name !== "input" && name !== "select" && name !== "textarea") return [];
    if (hasSpread(opening)) return [];
    if (name === "input" && NO_LABEL_NEEDED.has(attrString(getAttr(opening, "type")) ?? "")) return [];
    if (hasAttr(opening, "aria-label", "aria-labelledby", "title")) return [];
    const id = getAttr(opening, "id");
    // A dynamic id might be referenced by a label we can't see, so give it the benefit of the doubt.
    if (id && (attrString(id) === undefined || labelledIds.has(attrString(id)!))) return [];
    if (ancestors.some((a) => elementName(a.openingElement) === "label")) return [];

    const at = attrInsertPoint(opening);
    const placeholder = attrString(getAttr(opening, "placeholder"));
    if (placeholder?.trim()) {
      return [
        {
          ruleId: this.id,
          wcag: this.wcag,
          message: `<${name}> has no label. Using its placeholder as aria-label.`,
          fixKind: "auto",
          edits: [insert(at, jsxAttr("aria-label", placeholder.trim()))],
        },
      ];
    }
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: `<${name}> has no label.`,
        fixKind: "ai",
        aiRequest: {
          attribute: "aria-label",
          insertAt: at,
          hint: "A short label for what the user should enter, based on name, id, nearby text and how the value is used.",
        },
      },
    ];
  },
};
