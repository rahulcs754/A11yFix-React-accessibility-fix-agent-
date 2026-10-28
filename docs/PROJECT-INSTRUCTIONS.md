# A11yFix: project instructions

Context for anyone (or any AI session) working on this repo.

## Summary
A11yFix is a TypeScript CLI that scans React / Next.js code for WCAG errors, fixes them in the code, and opens a GitHub PR. Tools like axe only report problems; A11yFix edits the code. Demand is coming from the European Accessibility Act, which has applied since June 2025.

## Goal
Ship a working MVP in about 1 week, as a portfolio piece and a possible product.

## How it works
1. **Scan:** parse `.jsx/.tsx` with `@babel/parser` and walk the JSX tree.
2. **Fix:** apply safe fixes as small text edits, so formatting stays the same.
3. **AI fill:** for fixes that need words (alt text, labels), send the file and its issue list to Claude in one call per file, and get JSON back (Zod schema).
4. **PR:** create a branch, commit, push, then run `gh pr create` with a Markdown report (rule, WCAG criterion, file:line).

## MVP rules (8)
| Rule | WCAG | Fix |
|---|---|---|
| `img` / Next.js `Image` with no `alt` | 1.1.1 | AI writes the alt text |
| Icon-only `button` with no accessible name | 4.1.2 | AI writes the `aria-label` |
| `div`/`span` with `onClick` and no keyboard support | 2.1.1 | Auto: add `role="button"`, `tabIndex={0}`, and an Enter/Space `onKeyDown` |
| `a` with `onClick` and no `href` | 2.1.1 | Report only (should be a button) |
| `input`/`select`/`textarea` with no label | 1.3.1, 4.1.2 | Auto from `placeholder`, otherwise AI |
| `html` with no `lang` | 3.1.1 | Auto: `lang="en"` (`--lang` flag) |
| Positive `tabIndex` | 2.4.3 | Auto: set to `0` |
| `iframe` with no `title` | 4.1.2 | AI writes the title |

**Safety:** skip elements with a `{...props}` spread, never change tags or styles, and keep each edit small so PRs are easy to review.

## CLI
```
a11y-fix scan ./src
a11y-fix fix ./src [--ai] [--pr] [--dry-run] [--json]
```

## Stack
Node 20+, ESM, TypeScript, `@babel/parser` + `@babel/types`, `commander`, `picocolors`, `@anthropic-ai/sdk` (model `claude-opus-5-5`), `zod`, `vitest` with fixture files, and the `git` + `gh` CLIs.

## Build order
1. Scanner + 8 rules + fixture tests
2. Auto-fixer + `scan`/`fix` CLI + console report
3. Claude AI fill
4. `--pr` mode + Markdown PR body
5. Test on a real open-source React app, then write the README with before/after examples

## V2 ideas
- A GitHub Action that comments on each PR with new a11y issues
- Runtime checks with axe-core + Playwright (color contrast, focus order)
- Vue and Svelte support

## What exists now
- `src/scan.ts`: finds files, parses them, runs the rules
- `src/rules/`: one file per rule
- `src/jsx.ts`: JSX walker and attribute helpers
- `src/edits.ts`: attribute insert points and applying edits
- `src/fix.ts`, `src/ai.ts`, `src/report.ts`, `src/pr.ts`, `src/cli.ts`
- `test/`: rule tests, fixture app, AI tests with a stubbed client
- `docs/REAL-APP-TEST.md`: results on two open-source apps

Next: a live `--ai` run with an API key, then the v2 GitHub Action.
