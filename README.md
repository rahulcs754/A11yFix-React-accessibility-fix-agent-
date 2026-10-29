# A11yFix

Finds WCAG accessibility errors in React / Next.js code, fixes them in place, and opens a PR.

Tools like axe and eslint-plugin-jsx-a11y tell you what's wrong. A11yFix also changes the code: safe fixes are applied directly, and Claude writes the parts that need words (alt text, labels).

## Quick start
```bash
npm install
npm run build

npx a11yfix scan ./src                       # same as: node dist/cli.js scan ./src
node dist/cli.js scan ./src                  # report only (exit code 1 if issues)
node dist/cli.js scan ./src --url http://localhost:3000/   # also run axe-core on the live page
node dist/cli.js fix ./src --dry-run         # show what would change
node dist/cli.js fix ./src                   # apply safe fixes
ANTHROPIC_API_KEY=... node dist/cli.js fix ./src --ai        # also write alt text and labels
ANTHROPIC_API_KEY=... node dist/cli.js fix ./src --ai --pr   # also open a GitHub PR
```

`--pr` needs `git` and the GitHub CLI (`gh auth login`). It creates an `a11y-fix/<timestamp>` branch, commits only the fixed files, pushes, and opens a PR with a report table. You are left on the new branch.

Other options: `--json` for machine-readable output, `--report <file>` to save the Markdown report, `--lang <code>` for `<html lang>`, `--base <branch>` for the PR base.

## Live page scan (axe-core + Playwright)
`--url <urls...>` loads each page in headless Chromium and runs axe-core for the MVP error types: color contrast, image alt, form labels, empty links, empty buttons, page language (and iframe titles). Each error is mapped back to a JSX file and line:
1. React 18 dev builds: the exact `_debugSource` file and line from the React fiber.
2. Otherwise: a search of your JSX for the element's id, src, href, class and text (the React component name breaks ties).
3. Otherwise: the one source issue with the same rule and tag.

Color contrast is reported with the closest passing text color, but not changed automatically, because colors are a design decision. Needs Chromium: `npx playwright install chromium` (or set `A11YFIX_CHROMIUM_PATH`).

## GitHub Action
Runs the fixer in CI and opens one PR per run with a before/after report. See [docs/GITHUB-ACTION.md](docs/GITHUB-ACTION.md).

## PR report
Each PR has a table of fixes, a short explanation and a before/after snippet for every fix (with Claude's reason for AI values), the issues that still need a person, and the axe-core results with their source lines.

## Rules
| Rule | WCAG | What it catches | Fix |
|---|---|---|---|
| `img-alt` | 1.1.1 | `img` / Next.js `Image` with no `alt` | AI writes alt (`""` if decorative) |
| `button-name` | 4.1.2 | Icon-only `button`, or clickable icon with no text | AI writes `aria-label` |
| `link-name` | 2.4.4 | Icon-only `a href` / Next.js `Link` | AI writes `aria-label` |
| `click-keyboard` | 2.1.1 | `div`/`span`/`li`/`i` with `onClick` and no keyboard support | Auto: `role="button"`, `tabIndex={0}`, Enter/Space `onKeyDown` |
| `anchor-is-valid` | 2.1.1 | `a` with `onClick` and no `href` | Report only |
| `input-label` | 1.3.1 | `input`/`select`/`textarea` with no label | Auto from `placeholder`, otherwise AI |
| `html-lang` | 3.1.1 | `html` with no `lang` | Auto: `lang="en"` |
| `no-positive-tabindex` | 2.4.3 | `tabIndex` > 0 | Auto: `0` |
| `iframe-title` | 4.1.2 | `iframe` with no `title` | AI writes `title` |

**Safety:** elements with `{...props}` are skipped (the spread may already supply the attribute). Edits only insert or replace attributes; tags, styles and formatting are never changed. Clickable elements that already wrap a link or button are skipped.

## How it works
1. Parse `.js/.jsx/.tsx` with `@babel/parser` (skips `node_modules`, build output, tests and stories).
2. Each rule inspects JSX elements and returns issues with exact text edits.
3. `--ai`: one Claude call per file (`claude-opus-5-5`, structured JSON output) fills in the values. Values Claude is unsure about are marked "please check" in the PR.
4. Edits are applied back to the original source, so diffs stay small.

Color contrast is checked on the live page only (see `--url`).

## Deploying
A11yFix is a CLI and a GitHub Action, so there is nothing to deploy to Vercel. Use it with `npx`, in CI, or from the Action. A Vercel deploy would only make sense for a future web part (a landing page or a dashboard of reports).

## Tested on real apps
See [docs/REAL-APP-TEST.md](docs/REAL-APP-TEST.md).

## Docs
- [Project instructions](docs/PROJECT-INSTRUCTIONS.md)
- [MVP plan](docs/MVP-PLAN.md)

## Development
```bash
npm run typecheck
npm test
npm run dev -- scan ./test/fixtures/app
```
