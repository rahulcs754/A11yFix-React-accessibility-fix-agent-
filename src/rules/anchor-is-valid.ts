import { hasAttr, hasSpread } from "../jsx.js";
import type { Rule } from "../types.js";

/** `<a onClick>` with no href is not focusable and isn't a link. WCAG 2.1.1 Keyboard. */
export const anchorIsValid: Rule = {
  id: "anchor-is-valid",
  wcag: "2.1.1",
  check({ name, opening }) {
    if (name !== "a") return [];
    if (hasSpread(opening) || hasAttr(opening, "href") || !hasAttr(opening, "onClick")) return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: "<a onClick> has no href. Use a <button> for actions, or add a real href for navigation.",
        fixKind: "manual",
      },
    ];
  },
};
