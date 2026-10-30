# A11yFix

**Finds accessibility (WCAG) errors in your React / Next.js app, fixes them in the source code, and opens a pull request.**

Most tools (axe, Lighthouse, eslint-plugin-jsx-a11y) only give you a list of problems. A11yFix also writes the fix: safe fixes are applied directly, and Claude writes the parts that need words, such as alt text and labels. You review one small PR instead of fixing 50 issues by hand.

## Why it matters
- **Most sites fail.** 94.8% of the top 1 million home pages have WCAG errors (WebAIM Million). Missing alt text, empty buttons, unlabeled inputs and low contrast are the most common.
- **It is now the law in the EU.** The European Accessibility Act has applied since June 2025. Many products sold in the EU must meet WCAG, and fines are possible.
- **Overlays don't fix it.** Accessibility overlay widgets patch the page at runtime and are widely criticized. A11yFix changes the real code, so the fix is permanent and works without extra JavaScript.

## Benefits
- **Saves time:** finds and fixes common issues in minutes, not days of manual audit work.
- **Real code fixes:** small, reviewable edits in your JSX. Formatting, tags and styles are never changed.
- **Points to the exact line:** every issue, including ones found on the live page, is mapped to a file and line.
- **Explains each fix:** the PR says why each change was needed, with before/after code, so the team learns too.
- **Safe by default:** run `scan` or `--dry-run` first. Nothing changes until you say so, and every change goes through a normal PR review.
- **Runs anywhere:** on your laptop, in CI, or as a GitHub Action on a schedule.

## Use cases
1. **Before a launch or audit:** run it once on the whole app to clear the common WCAG errors before a manual audit.
2. **EU compliance:** a quick first step toward meeting the European Accessibility Act for products sold in the EU.
3. **Keep it fixed:** run the GitHub Action weekly so new issues are fixed in a PR automatically.
4. **Agencies and freelancers:** scan a client's React site and hand over a PR with fixes and a clear report.
5. **Learning:** each PR explains the WCAG rule behind every change, which helps a team build accessibility habits.

## Example
Before:
```tsx
<button onClick={() => setOpen(false)}><XIcon /></button>
<input type="email" placeholder="Email address" />
<html>
```
After `a11yfix fix ./src --ai`:
```tsx
<button aria-label="Close dialog" onClick={() => setOpen(false)}><XIcon /></button>
<input aria-label="Email address" type="email" placeholder="Email address" />
<html lang="en">
```

## How to use

### 1. Install
Not on npm yet, so install it from GitHub:
```bash
git clone https://github.com/rahulcs754/A11yFix-React-accessibility-fix-agent-.git a11yfix
cd a11yfix
npm install
npm run build
npm link            # makes the `a11yfix` command available everywhere
```

### 2. Scan your app (no changes)
```bash
cd your-react-app
a11yfix scan ./src                                  # source code check
a11yfix scan ./src --url http://localhost:3000/     # also check the running page (adds color contrast)
```
The `--url` scan needs Chromium once: `npx playwright install chromium`.

### 3. Fix
```bash
a11yfix fix ./src --dry-run                 # preview what would change
a11yfix fix ./src                           # apply safe fixes (no AI needed)
export ANTHROPIC_API_KEY=sk-ant-...
a11yfix fix ./src --ai                      # also let Claude write alt text, labels and titles
a11yfix fix ./src --ai --pr                 # also open a GitHub PR with the report
```
`--pr` needs `git` and the GitHub CLI (`gh auth login`). It creates an `a11y-fix/<timestamp>` branch, commits only the fixed files, pushes, and opens a PR. You are left on the new branch.

Other options: `--json` for machine-readable output, `--report <file>` to save the Markdown report, `--lang <code>` for `<html lang>`, `--base <branch>` for the PR base.

### 4. Automate with the GitHub Action
Add a workflow that runs A11yFix every week and opens one PR per run. Setup and a ready-to-copy workflow are in [docs/GITHUB-ACTION.md](docs/GITHUB-ACTION.md).

## Live page scan (axe-core + Playwright)
`--url <urls...>` loads each page in headless Chromium and runs axe-core for the MVP error types: color contrast, image alt, form labels, empty links, empty buttons, page language (and iframe titles). Each error is mapped back to a JSX file and line:
1. React 18 dev builds: the exact `_debugSource` file and line from the React fiber.
2. Otherwise: a search of your JSX for the element's id, src, href, class and text (the React component name breaks ties).
3. Otherwise: the one source issue with the same rule and tag.

Color contrast is reported with the closest passing text color, but not changed automatically, because colors are a design decision. Needs Chromium: `npx playwright install chromium` (or set `A11YFIX_CHROMIUM_PATH`).

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

## Development
```bash
npm run typecheck
npm test
npm run dev -- scan ./test/fixtures/app
```
