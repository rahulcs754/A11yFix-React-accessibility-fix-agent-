# A11yFix

Finds WCAG accessibility errors in React / Next.js code, fixes them, and opens a PR.

> Status: early work. The scaffold is in place; the scanner is next.

## Planned usage
```
a11y-fix scan ./src            # report only
a11y-fix fix ./src             # apply safe fixes
a11y-fix fix ./src --ai        # also write alt text and labels with Claude
a11y-fix fix ./src --ai --pr   # also open a GitHub PR
```

## Docs
- [Project instructions](docs/PROJECT-INSTRUCTIONS.md): summary, rules, stack, and build order
- [MVP plan](docs/MVP-PLAN.md)

## Development
```
npm install
npm run typecheck
npm test
```
