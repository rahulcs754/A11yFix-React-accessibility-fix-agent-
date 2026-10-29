# Publishing to npm

The package is published as **`@rahulcs754/a11yfix`**. The plain name `a11yfix` is already taken on npm by another project, so we use a scoped name. The command is still `a11yfix`:

```bash
npx @rahulcs754/a11yfix scan ./src
# or install it, then:
npm i -D @rahulcs754/a11yfix
npx a11yfix fix ./src --ai --pr
```

## One-time setup
1. Make sure the npm scope matches your npm username. If your npm user is not `rahulcs754`, change `name` in `package.json` to `@<your-npm-user>/a11yfix`.
2. On npmjs.com, go to Access Tokens and create a **Granular** token with read and write access to packages.
3. In this repo, go to Settings, then Secrets and variables, then Actions, and add it as `NPM_TOKEN`.

## Releasing a version
1. Bump `version` in `package.json` (for example to `0.2.0`) and merge it to `main`.
2. Create a GitHub release with the tag `v0.2.0`.
3. The **Publish to npm** workflow checks that the tag matches the version, then publishes with provenance. `prepublishOnly` runs typecheck, tests and build first.

To check the package locally without publishing: `npm pack --dry-run`.
