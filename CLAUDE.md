# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this repo is

A template for Google Apps Script projects written in TypeScript. Several scripts
live side by side under `apps/`; each is bundled by Rollup into a single
`dist/index.js` and uploaded with `clasp`. Nothing runs locally — the Apps Script
runtime is the only execution environment for `apps/**`, so local checks are
limited to lint, typecheck and unit tests of pure functions.

## Commands

```bash
pnpm run new <app> [--create] [--type sheets|docs|forms|slides|standalone|webapp|api]
pnpm run build [app]     # Rollup + copy appsscript.json into dist/
pnpm run push <app>      # build + clasp push — updates the editor code
pnpm run deploy <app>    # push + new version (required for web apps / API executables)
pnpm run lint            # ESLint + Prettier --fix
pnpm run typecheck       # tsc --noEmit
pnpm run test            # Jest (*.spec.ts)
pnpm run verify          # everything CI runs
```

Always `pnpm run <script>` — `pnpm deploy` is a built-in pnpm command.
Single test: `pnpm run test -- path/to/file.spec.ts` or `-t 'name'`.

## Architecture

- **An app is a folder.** Any `apps/<name>/` with a `src/index.ts` is an app.
  `scripts/apps.mjs` is the single source of truth; build, clasp wrapper and the
  CI matrix all derive from it. Adding a script means creating a folder — never
  editing config.
- **`src/index.ts` is the boundary.** Rollup produces one file with no module
  system, so only what is passed to `expose()` (`Object.assign(globalThis, …)`)
  can be reached by triggers, menus, `doGet`/`doPost` or the editor's Run button.
  Keep logic in plain functions under `src/`, keep Google API calls at the entry
  point — that is what makes the logic testable.
- **`libs/shared` is imported as `@shared`.** The alias is declared three times
  and all three must stay in sync: `tsconfig.json` `paths` (editor + tsc),
  `jest.config.mjs` `moduleNameMapper` (tests), `rollup.config.mjs` alias plugin
  (bundle).
- **Config comes from `getEnv()`** (`libs/shared/get-env.ts`): Script Properties
  in the runtime, `process.env`/`.env` locally. Nothing else reads either source.
- **`push` vs `deploy`.** `clasp push` updates the editor code, which triggers
  pick up immediately. Web apps and API executables serve the *deployed version*,
  so any change to `doGet`/`doPost` or their dependencies needs `pnpm run deploy`.
  Deployment ids are reused (`CLASP_DEPLOYMENTS` or `<APP>_DEPLOYMENT_ID`) to keep
  URLs stable — never create a new deployment for an app that already has one.

## Conventions

- Prettier: single quotes, no semicolons, 2-space indent (`.prettierrc.json`).
- `apps/<app>/appsscript.json` is the manifest: timezone, `oauthScopes`,
  advanced services, `webapp` access. Adding a scope forces re-authorization and
  silently stops triggers until someone accepts it in the editor.
- `templates/app/` is what `pnpm run new` copies; `__APP_NAME__` and
  `__APP_TITLE__` are substituted. It is excluded from tsconfig, ESLint and Jest —
  edit it as a template, not as compiled code.
- Advanced service typings are optional, hence `AdminDirectory.Users!.insert(...)`.
- `--no-treeshake` is deliberate: the runtime resolves some names dynamically.

## Gotchas

- **`muteHttpExceptions: true` does not throw on 4xx/5xx.** Use `fetchOk` /
  `fetchJson` from `@shared`, or check `getResponseCode()` by hand — otherwise
  failures pass silently and the script reports success.
- **Google APIs are eventually consistent.** A freshly created user or file can
  404 for seconds. Wrap those calls in `withRetry()` and decide explicitly
  whether a final failure is fatal.
- **Shared egress IPs get rate-limited.** `UrlFetchApp` leaves through IPs shared
  by all Apps Script projects; providers behind Cloudflare return 429 regardless
  of your own volume. In-execution retries do not outlast those bans — persist the
  work and retry from a later time-based trigger.
- **Installable triggers are code, not config.** They must be created by a
  function run once from the editor, and re-run when changed.
- **Quotas:** 6 minutes per execution (30 on Workspace plans), 20 000 UrlFetch
  calls per day. Long work belongs in a queue drained by a timer.
