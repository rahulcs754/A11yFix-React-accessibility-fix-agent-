/** Short, plain explanation of each rule's problem and fix, shown in reports and PRs. */
export const EXPLANATIONS: Record<string, string> = {
  "img-alt": "Screen readers can't describe an image without alt text, so blind users miss what it shows.",
  "button-name": 'A button with only an icon is read as just "button", so users can\'t tell what it does.',
  "link-name": 'A link with only an icon is read as its URL or just "link", so users can\'t tell where it goes.',
  "click-keyboard":
    "Keyboard users can't focus or press a clickable div/span. The fix adds a button role, makes it focusable, and runs the click on Enter or Space.",
  "anchor-is-valid": "A link without href can't be reached with the keyboard. Change it to a <button> (tags are never changed automatically).",
  "input-label": "A field with no label is read with no name, so users don't know what to type. A placeholder alone is not a label.",
  "html-lang": "Screen readers need the page language to pronounce words correctly.",
  "no-positive-tabindex": "A positive tabIndex makes focus jump around the page. Setting it to 0 keeps the natural order.",
  "iframe-title": 'An iframe without a title is read as just "frame", so users can\'t tell what the embed is.',
  "color-contrast": "Text with low contrast is hard to read for people with low vision or in bright light.",
};
