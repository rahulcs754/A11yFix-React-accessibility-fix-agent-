import { attrNumber, getAttr } from "../jsx.js";
import type { Rule } from "../types.js";

/** tabIndex > 0 breaks the natural focus order. WCAG 2.4.3 Focus Order. */
export const noPositiveTabindex: Rule = {
  id: "no-positive-tabindex",
  wcag: "2.4.3",
  check({ opening }) {
    const attr = getAttr(opening, "tabIndex");
    const n = attrNumber(attr);
    if (!attr?.value || n === undefined || n <= 0) return [];
    return [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: `tabIndex={${n}} breaks the natural focus order. Setting it to 0.`,
        fixKind: "auto",
        edits: [{ start: attr.value.start!, end: attr.value.end!, text: "{0}" }],
      },
    ];
  },
};
