import { attrInsertPoint } from "../edits.js";
import { attrString, getAttr, hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

/** `<img>` and Next.js `<Image>` need alt text. WCAG 1.1.1 Non-text Content. */
export const imgAlt: Rule = {
  id: "img-alt",
  wcag: "1.1.1",
  check({ name, opening }) {
    if (name !== "img" && name !== "Image") return [];
    if (hasSpread(opening) || hasAttr(opening, "alt")) return [];
    if (attrString(getAttr(opening, "aria-hidden")) === "true") return [];
    const role = attrString(getAttr(opening, "role"));
    if (role === "presentation" || role === "none") return [];
    if (hasAttr(opening, "aria-label", "aria-labelledby")) return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: `<${name}> has no alt text.`,
        fixKind: "ai",
        aiRequest: {
          attribute: "alt",
          insertAt: attrInsertPoint(opening),
          hint: 'Short alt text that says what the image shows or does. Use "" only if the image is purely decorative.',
        },
      },
    ];
  },
};
