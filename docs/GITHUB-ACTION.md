# GitHub Action

A11yFix runs as a GitHub Action. Each run scans the repo, fixes what it can, and opens **one PR** with a before/after report. The same report is added to the run's job summary.

## Setup
1. In the target repo, go to **Settings → Actions → General → Workflow permissions** and turn on **Allow GitHub Actions to create and approve pull requests**.
2. Add `ANTHROPIC_API_KEY` under **Settings → Secrets and variables → Actions** (only needed for AI fixes).
3. Add this workflow as `.github/workflows/a11yfix.yml`:

```yaml
name: A11yFix
on:
  workflow_dispatch:        # run by hand from the Actions tab
  schedule:
    - cron: "0 3 * * 1"     # and every Monday

permissions:
  contents: write
  pull-requests: write

jobs:
  a11yfix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rahulcs754/A11yFix-React-accessibility-fix-agent-@main
        with:
          path: src
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # Optional: also scan the running app with axe-core (adds color contrast).
          # start-command: npm ci && npm run build && npm start
          # urls: http://localhost:3000/ http://localhost:3000/login
```

## Inputs
| Input | Default | What it does |
|---|---|---|
| `path` | `.` | Folder to scan |
| `ai` | `true` | Let Claude write alt text, labels and titles |
| `anthropic-api-key` | | Needed when `ai` is `true` |
| `urls` | | Pages to scan with axe-core + Playwright |
| `start-command` | | Starts your app in the background before the URL scan |
| `lang` | `en` | Value for `<html lang>` |
| `base` | repo default | Base branch for the PR |
| `github-token` | `github.token` | Token used to push and open the PR |

If nothing can be fixed, no PR is opened. Issues that need a person (for example color contrast) are listed in the PR and the job summary.
