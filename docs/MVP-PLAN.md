# A11y Fix Agent for React: MVP plan

**One line:** A CLI (and later a GitHub Action) that scans a React / Next.js repo for WCAG errors, fixes them in code, and opens a PR.

**Why now:** The European Accessibility Act has applied since June 2025. Teams need fixes, not just audit reports. Tools like axe only report problems; this one edits the code.

## How it works
1. **Scan:** parse every `.jsx/.tsx` file with the Babel parser and walk the JSX tree.
2. **Fix:** apply safe fixes with exact text edits (formatting stays the same).
3. **AI fill:** for fixes that need words (alt text, labels), send the file plus the issue list to Claude in one call per file and get back structured JSON.
4. **PR:** create a branch, commit, push, and open a PR with a Markdown report (rule, WCAG criterion, file:line).

## MVP rules (8)
| Rule | WCAG | Fix |
|---|---|---|
| `<img>` / next `Image` missing `alt` | 1.1.1 | AI writes the alt text |
| Icon-only `<button>` with no name | 4.1.2 | AI writes the `aria-label` |
| `div/span onClick` with no keyboard support | 2.1.1 | Auto: `role="button"`, `tabIndex={0}`, Enter/Space `onKeyDown` |
| `<a onClick>` with no `href` | 2.1.1 | Report only (should be a `<button>`) |
| Input/select/textarea with no label | 1.3.1 / 4.1.2 | Auto from `placeholder`, otherwise AI |
| `<html>` with no `lang` | 3.1.1 | Auto: `lang="en"` (flag to change) |
| Positive `tabIndex` | 2.4.3 | Auto: set to `0` |
| `<iframe>` with no `title` | 4.1.2 | AI writes the title |

Safety rules: skip elements with `{...props}` spread, never change tags or styles, and keep every edit small so the PR is easy to review.

## CLI
```
a11y-fix scan ./src            # report only
a11y-fix fix ./src             # safe fixes
a11y-fix fix ./src --ai        # plus AI-written alt text and labels
a11y-fix fix ./src --ai --pr   # plus branch, commit and PR
```

## Stack
TypeScript (Node 20+, ESM), `@babel/parser`, `commander`, `@anthropic-ai/sdk` (model `claude-opus-5-5`, structured outputs with Zod), `vitest` with fixture files, `git` + `gh` to open the PR.

## Build order (about 1 week)
1. Scanner + the 8 rules + fixture tests
2. Safe auto-fixer + `scan`/`fix` CLI + console report
3. AI fill with Claude
4. `--pr` mode + Markdown PR body
5. Run it on a real open-source React app, then write the README with before/after screenshots

## Later (v2)
- A GitHub Action that comments on each PR with new a11y issues
- A runtime check with axe-core + Playwright for color contrast and focus order
- Support for Vue and Svelte

## Status
Build steps 1 to 5 are done: scanner, 8 rules, auto-fixer, CLI, Claude AI fill, PR mode, and a real-app test (see `REAL-APP-TEST.md`). Also done: `link-name` rule, `--url` live scan with axe-core + Playwright (incl. color contrast), explanations and before/after in the PR report, and the GitHub Action. Next: a live `--ai` run with an API key, then publish to npm as `@rahulcs754/a11yfix` (see `PUBLISHING.md`).
