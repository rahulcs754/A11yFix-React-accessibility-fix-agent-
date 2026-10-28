import type {
  Expression,
  JSXAttribute,
  JSXElement,
  JSXFragment,
  JSXOpeningElement,
  Node,
} from "@babel/types";

export function elementName(opening: JSXOpeningElement): string {
  const n = opening.name;
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression") return ""; // e.g. motion.div - skip for now
  return `${n.namespace.name}:${n.name.name}`;
}

export function isDomElement(name: string): boolean {
  return /^[a-z]/.test(name);
}

export function hasSpread(opening: JSXOpeningElement): boolean {
  return opening.attributes.some((a) => a.type === "JSXSpreadAttribute");
}

export function getAttr(opening: JSXOpeningElement, name: string): JSXAttribute | undefined {
  for (const a of opening.attributes) {
    if (a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === name) {
      return a;
    }
  }
  return undefined;
}

export function hasAttr(opening: JSXOpeningElement, ...names: string[]): boolean {
  return names.some((n) => getAttr(opening, n) !== undefined);
}

/**
 * Static string value of an attribute, if we can know it.
 * `alt="x"` and `alt={"x"}` and `alt={`x`}` give "x". Dynamic values give undefined.
 */
export function attrString(attr: JSXAttribute | undefined): string | undefined {
  if (!attr || !attr.value) return undefined;
  const v = attr.value;
  if (v.type === "StringLiteral") return v.value;
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression;
    if (e.type === "StringLiteral") return e.value;
    if (e.type === "TemplateLiteral" && e.expressions.length === 0) return e.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** Numeric value of `tabIndex={1}` / `tabIndex="1"`, if static. */
export function attrNumber(attr: JSXAttribute | undefined): number | undefined {
  if (!attr || !attr.value) return undefined;
  const v = attr.value;
  if (v.type === "StringLiteral") return Number.isNaN(Number(v.value)) ? undefined : Number(v.value);
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression;
    if (e.type === "NumericLiteral") return e.value;
    if (e.type === "UnaryExpression" && e.operator === "-" && e.argument.type === "NumericLiteral") {
      return -e.argument.value;
    }
  }
  return undefined;
}

/**
 * Does this element have content a screen reader can announce?
 * Text, expressions ({label}), or children with their own accessible name count.
 * Plain icons (<svg/>, <Icon/>) with no label do not.
 */
export function hasAccessibleContent(el: JSXElement): boolean {
  for (const child of el.children) {
    switch (child.type) {
      case "JSXText":
        if (child.value.trim()) return true;
        break;
      case "JSXExpressionContainer":
        if (child.expression.type !== "JSXEmptyExpression" && expressionHasContent(child.expression)) return true;
        break;
      case "JSXSpreadChild":
        return true;
      case "JSXFragment":
      case "JSXElement":
        if (jsxHasContent(child)) return true;
        break;
    }
  }
  return false;
}

function jsxHasContent(node: JSXElement | JSXFragment): boolean {
  // Treat a fragment like a wrapper element.
  if (node.type === "JSXFragment") return hasAccessibleContent({ children: node.children } as JSXElement);
  const o = node.openingElement;
  if (hasAttr(o, "aria-label", "aria-labelledby", "title")) return true;
  const name = elementName(o);
  if (name === "img" && attrString(getAttr(o, "alt"))) return true;
  // Custom components may render text we can't see; svgs/icons usually don't.
  if (name && !isDomElement(name) && !/Icon$|^Svg|Svg$/.test(name)) return true;
  return hasAccessibleContent(node);
}

/** `{label}` counts as content. `{open ? <XIcon /> : <MenuIcon />}` does not. */
function expressionHasContent(e: Expression): boolean {
  switch (e.type) {
    case "JSXElement":
    case "JSXFragment":
      return jsxHasContent(e);
    case "ConditionalExpression":
      return expressionHasContent(e.consequent) || expressionHasContent(e.alternate);
    case "LogicalExpression":
      return e.operator === "&&" ? expressionHasContent(e.right) : expressionHasContent(e.left) || expressionHasContent(e.right);
    case "NullLiteral":
    case "BooleanLiteral":
      return false;
    case "StringLiteral":
      return e.value.trim() !== "";
    case "ParenthesizedExpression":
      return expressionHasContent(e.expression);
    default:
      // Variables, calls, etc. may hold text; we can't know, so assume they do.
      return true;
  }
}

/** True when a child is already keyboard-usable, e.g. `<li onClick><a href>..</a></li>`. */
export function hasInteractiveDescendant(el: JSXElement): boolean {
  for (const child of el.children) {
    if (child.type !== "JSXElement") continue;
    const o = child.openingElement;
    const name = elementName(o);
    if (["button", "input", "select", "textarea"].includes(name)) return true;
    if (name === "a" && hasAttr(o, "href")) return true;
    if (hasInteractiveDescendant(child)) return true;
  }
  return false;
}

/** Walks every node, calling `visit` on JSX elements with their JSX ancestors. */
export function walkJsx(
  root: Node,
  visit: (el: JSXElement, ancestors: JSXElement[]) => void,
): void {
  const stack: JSXElement[] = [];
  const go = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) go(n);
      return;
    }
    const n = node as Node;
    if (typeof n.type !== "string") return;
    const isEl = n.type === "JSXElement";
    if (isEl) {
      visit(n, stack);
      stack.push(n);
    }
    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") continue;
      go((n as unknown as Record<string, unknown>)[key]);
    }
    if (isEl) stack.pop();
  };
  go(root);
}
