import { attrInsertPoint, insert } from "../edits.js";
import { attrString, getAttr, hasAccessibleContent, hasAttr, hasInteractiveDescendant, hasSpread, isDomElement } from "../jsx.js";
import type { Edit, Issue, Rule } from "../types.js";

/** Elements that already handle keyboard and focus on their own. */
const INTERACTIVE = new Set([
  "a", "button", "input", "select", "textarea", "summary", "option", "label", "details",
  // SVG elements have no .click(), so the generated handler would not type-check.
  "svg", "path", "g",
]);

const KEY_HANDLER =
  'onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}';

/**
 * A clickable `<div>` / `<span>` can't be reached or used with a keyboard.
 * WCAG 2.1.1 Keyboard. Fix: role="button", tabIndex={0}, Enter/Space handler.
 */
export const clickKeyboard: Rule = {
  id: "click-keyboard",
  wcag: "2.1.1",
  check({ name, opening, element }) {
    if (!isDomElement(name) || INTERACTIVE.has(name)) return [];
    if (hasInteractiveDescendant(element)) return [];
    if (!hasAttr(opening, "onClick") || hasSpread(opening)) return [];
    if (attrString(getAttr(opening, "aria-hidden")) === "true") return [];
    const role = attrString(getAttr(opening, "role"));
    if (role === "presentation" || role === "none") return [];

    const at = attrInsertPoint(opening);
    const edits: Edit[] = [];
    const missing: string[] = [];
    if (!hasAttr(opening, "role")) {
      edits.push(insert(at, 'role="button"'));
      missing.push("role");
    }
    if (!hasAttr(opening, "tabIndex")) {
      edits.push(insert(at, "tabIndex={0}"));
      missing.push("tabIndex");
    }
    if (!hasAttr(opening, "onKeyDown", "onKeyUp", "onKeyPress")) {
      edits.push(insert(at, KEY_HANDLER));
      missing.push("keyboard handler");
    }
    if (edits.length === 0) return [];
    const issues: Omit<Issue, "file" | "line" | "column" | "snippet">[] = [
      {
        ruleId: this.id,
        wcag: this.wcag,
        message: `<${name} onClick> can't be used with a keyboard (missing ${missing.join(", ")}).`,
        fixKind: "auto",
        edits,
      },
    ];
    // An icon like <i className="ion-trash" onClick> becomes a button with no name, so it needs a label too.
    if (!hasAttr(opening, "aria-label", "aria-labelledby", "title") && !hasAccessibleContent(element)) {
      issues.push({
        ruleId: "button-name",
        wcag: "4.1.2",
        message: `Clickable <${name}> has no text, so screen readers can't name it.`,
        fixKind: "ai",
        aiRequest: {
          attribute: "aria-label",
          insertAt: at,
          hint: "A short label for what clicking it does, based on the handler name and icon class.",
        },
      });
    }
    return issues;
  },
};
