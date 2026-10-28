# Real app test (2026-10-28)

## 1. gothinkster/react-redux-realworld-example-app
The "RealWorld" Medium clone, a well-known React + Redux app (38 files).

`a11y-fix fix src` found **19 issues** and fixed **17** with no AI:
- 15 x `input-label`: login, register, settings and editor fields had only placeholders. Each got a matching `aria-label`.
- 2 x `click-keyboard`: the delete-comment trash icon and the remove-tag icon were `<i onClick>`. Each got `role="button"`, `tabIndex={0}` and an Enter/Space handler.
- 2 x `button-name` left for `--ai`: those same two icons have no text, so they also need an `aria-label` ("Delete comment", "Remove tag").

Example diff:
```diff
-        <i className="ion-trash-a" onClick={del}></i>
+        <i role="button" tabIndex={0} onKeyDown={(e) => { ... }} className="ion-trash-a" onClick={del}></i>
-                    <input
+                    <input aria-label="Email"
```

What the test changed in the tool:
- A clickable `<li>` in the pagination already wraps an `<a href>`, so keyboard users can already reach it. The rule now skips elements that contain a link, button or form field.
- Icons with `onClick` and no text now also get a `button-name` issue, because adding `role="button"` alone would create a button with no name.

`--pr` mode was run on a copy of this app with a local git remote and a stub `gh`. It made the branch, committed the 6 changed files, pushed, and passed the Markdown report as the PR body. While doing this we found that raw tags like `<textarea>` in the table would render as HTML on GitHub, so they are now escaped.

## 2. shadcn-ui/taxonomy
A modern Next.js 13 App Router + TypeScript app (98 files).

`a11y-fix scan .` found **0 issues**. We checked this by hand: every `Image` has `alt`, `<html lang="en">` is set, and the icon-toggle mobile menu button also has a visible "Menu" label. No false positives, and no parse errors on the TSX.

## AI step
No API key was available in the build environment, so:
- Unit tests run the AI step with a stubbed client. They check the request, insert the values, handle a decorative `alt=""`, refuse empty labels, and handle refusals.
- A local capture server confirmed the real HTTP request: `model: claude-opus-5-5`, structured JSON schema output, `fallbacks: "default"`, and that API errors are reported without stopping the run.

To try it live: `ANTHROPIC_API_KEY=... node dist/cli.js fix <dir> --ai --dry-run`.
