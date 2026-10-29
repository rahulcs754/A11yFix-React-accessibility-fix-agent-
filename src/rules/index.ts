import type { Rule } from "../types.js";
import { anchorIsValid } from "./anchor-is-valid.js";
import { buttonName } from "./button-name.js";
import { clickKeyboard } from "./click-keyboard.js";
import { htmlLang } from "./html-lang.js";
import { iframeTitle } from "./iframe-title.js";
import { imgAlt } from "./img-alt.js";
import { inputLabel } from "./input-label.js";
import { linkName } from "./link-name.js";
import { noPositiveTabindex } from "./no-positive-tabindex.js";

export const rules: Rule[] = [
  imgAlt,
  buttonName,
  linkName,
  clickKeyboard,
  anchorIsValid,
  inputLabel,
  htmlLang,
  noPositiveTabindex,
  iframeTitle,
];
