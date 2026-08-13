# Apps Script + TypeScript template

A repo template for building **Google Apps Script** projects like normal
software: TypeScript, ESLint, Prettier, Jest, CI/CD — and as many scripts as you
want in a single repository, each with its own script id and deployment.

```bash
pnpm install
pnpm run new my-app --create --type sheets   # scaffold + create the project on Google
pnpm run push my-app                         # build + upload
```

That's the whole loop. No editor tab, no copy-pasting into script.google.com.

---

## Why

Apps Script is the fastest way to automate Google Workspace, and the worst place
to write code: a browser editor, no types, no tests, no version control, no way
to share a helper between two projects. `clasp` fixes the upload part but leaves
you with one repo per script and a bare `.js` file.

This template keeps the good part (a runtime that already has your Sheets, Gmail,
Drive and Admin SDK authenticated) and moves everything else onto your machine.

## Features

| | |
| --- | --- |
| **TypeScript → one file** | Rollup bundles each app into a single `dist/index.js` the runtime can execute. Full `@types/google-apps-script` autocomplete for `SpreadsheetApp`, `MailApp`, `UrlFetchApp`… |
| **Many scripts, one repo** | An app is any folder under `apps/` with a `src/index.ts`. Separate script id, manifest, scopes and deployment; shared tooling and shared code. |
| **Scaffolding** | `pnpm run new <name>` writes the app, and can create the Apps Script project on Google in the same command (`--create --type sheets\|docs\|forms\|slides\|standalone\|webapp\|api`). |
| **Shared library** | `libs/shared`, imported as `@shared` — config, retries, HTTP with real error checking, `expose()`. Alias resolved in the editor, in Jest and in the bundle. |
| **Real tests** | Jest + ts-jest. Business logic stays in plain functions and gets unit-tested; only the entry point touches the Google globals. |
| **Lint & format** | ESLint 9 flat config + Prettier, applied to apps, libs and build scripts alike. |
| **CI/CD** | GitHub Actions: lint + typecheck + test + build on every push; deploy on `main` — **only the apps that changed**, in a matrix, one job each. |
| **Stable web app URLs** | Deployments reuse a stored deployment id, so approving OAuth once and sharing a URL once is enough. |
| **Environment config** | `getEnv()` reads Script Properties in production and `.env` locally, so the same code runs in both. |

## Getting started

1. **Use this template** (green button) or `gh repo create my-scripts --template moha-tah/apps-script-ts-template`
2. `pnpm install`
3. `pnpm exec clasp login` — once per machine, writes `~/.clasprc.json`
4. Enable the Apps Script API for your account: <https://script.google.com/home/usersettings>
5. Create your first script:

```bash
pnpm run new my-app --create --type sheets
```

`--create` makes a new Spreadsheet + bound script and writes its id into
`apps/my-app/.clasp.json`. Already have a script? Skip `--create` and paste the
id from **Apps Script editor → Project Settings → Script ID**, or pass
`--script-id <id>`.

6. `pnpm run push my-app`, then open the editor with `pnpm run open my-app`.

## Commands

All of them take an app name; with a single app in the repo you can leave it out.

```bash
pnpm run new <app> [--create] [--type …]  # scaffold a new script
pnpm run apps                             # list apps and their script ids
pnpm run build [app]                      # bundle to apps/<app>/dist
pnpm run push <app>                        # build + clasp push (updates the editor)
pnpm run deploy <app>                      # push + new version of the web app / API
pnpm run open <app>                        # open the Apps Script editor
pnpm run logs <app>                        # tail executions (Cloud Logging)
pnpm run lint                              # ESLint + Prettier, with --fix
pnpm run typecheck                         # tsc --noEmit
pnpm run test                              # Jest
pnpm run verify                            # everything CI runs
```

Use `pnpm run` and not `pnpm <script>`: `deploy` is also a built-in pnpm command.
Anything after `--` goes straight to clasp: `pnpm run push my-app -- --watch`.

## Repo layout

```
apps/                       one directory per Apps Script project
  my-app/
    .clasp.json             scriptId + rootDir: dist
    appsscript.json         manifest — timezone, OAuth scopes, advanced services
    src/index.ts            entry point: expose() what the runtime must reach
    src/functions/…         your code, unit-testable
    dist/                   generated bundle — what clasp uploads (git-ignored)
libs/shared/                code shared by every app, imported as @shared
scripts/                    the automation: new-app, build, clasp, changed-apps
templates/app/              what `pnpm run new` copies
.github/workflows/          CI (verify) and CD (deploy changed apps)
```

Root config — `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`,
`jest.config.mjs`, `rollup.config.mjs` — is shared by every app. Adding a script
never means touching a config file: the build, the deploy and the CI matrix all
derive from what is in `apps/`.

## Writing an app

`src/index.ts` is the only file the runtime really sees. Rollup bundles
everything into one file, so nothing is global unless you say so — that is what
`expose()` is for:

```ts
import { expose, getEnv, withRetry } from '@shared'

import { buildReport } from './functions/report'

function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Reports')
    .addItem('Send today’s report', 'sendReport')
    .addToUi()
}

function sendReport(): void {
  const recipient = getEnv('REPORT_RECIPIENT') ?? Session.getActiveUser().getEmail()
  withRetry(() => MailApp.sendEmail(recipient, 'Report', buildReport()))
}

// Triggers, menu callbacks, doGet/doPost, anything you run from the editor:
expose({ onOpen, sendReport })
```

Keep logic in plain functions (`buildReport`) and the Google API calls in the
entry point — that is what makes the logic testable without mocking half of
Workspace.

## Configuration

`getEnv(key)` reads **Script Properties** in the Apps Script runtime and
`process.env` / `.env` everywhere else, so one code path works in both:

```ts
const token = requireEnv('API_TOKEN') // throws with a helpful message if unset
if (isTestMode()) { /* TEST=true — redirect mail, use a test webhook … */ }
```

Set production values in **Project Settings → Script Properties** (they are
per-script, so two apps never collide). Copy `.env.example` to `.env` for local
runs and tests.

## Deploying

Two different things, and mixing them up is the classic Apps Script bug:

- **`pnpm run push`** updates the code in the editor. Triggers immediately run
  the new code.
- **`pnpm run deploy`** publishes a new *version*. Web apps and API executables
  serve the deployed version — for those, a push alone changes nothing.

`deploy` reuses a stored deployment id so the web app URL never changes. Ids
live in **`deployments.json`** at the repo root:

```json
{ "my-app": "AKfycb…" }
```

It is committed on purpose. A deployment id is not a credential — it is the
public part of the web app URL, and who may call that URL is decided by the
manifest (`executeAs`, `access`), not by knowing the id. Keeping it next to the
`scriptId` means `pnpm run deploy` behaves identically on a laptop and in CI,
with nothing to configure.

One override wins over the file, for a one-off deploy or an id somebody would
rather not commit: `CLASP_DEPLOYMENTS={"my-app":"AKfycb…"}`, in `.env` locally
or as a repository secret in CI.

With no id anywhere, a fresh deployment is created and its id printed — save it
to `deployments.json`. That bootstrap only happens when *you* run `deploy`; CI
never mints a URL (see below). To recover the id of an existing deployment:

```bash
pnpm exec clasp -P apps/my-app list-deployments
```

Take the versioned one, not `@HEAD` — every project has an automatic `@HEAD`
test deployment that is not what the web app serves.

### GitHub Actions

`ci.yaml` runs lint, typecheck, tests and a full build on every push and PR.

`deploy.yaml` runs on `main` and deploys **only the apps whose files changed** —
or all of them when something shared changed (`libs/`, `scripts/`, root config),
since that can alter every bundle. Two secrets:

| Secret | Contents |
| --- | --- |
| `CLASP_CREDENTIALS` | The whole `~/.clasprc.json` produced by `pnpm exec clasp login` — the only one required |
| `CLASP_DEPLOYMENTS` | Optional override for `deployments.json`; normally unset |

You can also deploy by hand from the Actions tab (**Deploy → Run workflow**),
optionally naming a single app.

Two things the deploy job deliberately does *not* do, so that adding a script to
the repo never turns CI red or leaves clutter behind on Google:

- **An app missing from `CLASP_DEPLOYMENTS` is pushed, not deployed**
  (`--no-new-deployment`). Most apps are bound scripts that never needed a
  deployment, and minting a fresh one on every merge would pile them up. When
  the app's manifest declares a `webapp` or an `executionApi`, the job warns
  instead — its first deployment stays a manual `pnpm run deploy <app>`, because
  the URL that prints has to be stored back in the secret first.
- **An app with no `scriptId` is skipped entirely**, and reported as a workflow
  warning. Its Apps Script project does not exist on Google yet, so there is
  nothing to push to — the normal state of a freshly scaffolded app.

## Apps Script gotchas worth knowing

Things this template already handles, or that will bite you anyway:

- **`muteHttpExceptions: true` swallows HTTP errors.** `UrlFetchApp.fetch` stops
  throwing on 4xx/5xx, so a failed call looks successful unless you check
  `getResponseCode()`. `fetchOk()` / `fetchJson()` in `@shared` always do.
- **`clasp push` ≠ deploy** for web apps. See above.
- **Adding an OAuth scope forces re-authorization.** Triggers stop firing until
  someone opens the project and accepts the new scopes. Keep `oauthScopes` in
  `appsscript.json` minimal and deliberate.
- **Google APIs are eventually consistent.** A just-created Workspace user or
  Drive file can 404 for a few seconds — `withRetry()` exists for that.
- **External endpoints rate-limit the shared egress IPs.** `UrlFetchApp` goes out
  through IPs shared by every Apps Script project; some providers (anything
  behind Cloudflare) answer 429 for reasons that have nothing to do with you.
  Retrying inside the same execution rarely helps — queue the work and retry from
  a later time-based trigger.
- **Simple triggers vs installable ones.** `onOpen`/`onEdit` are called by name
  and need no registration; `onFormSubmit` & co must be installed
  (`ScriptApp.newTrigger(...)`) — do it in a function you run once from the
  editor, and re-run it whenever it changes.
- **Advanced services are declared twice.** In `appsscript.json`
  (`enabledAdvancedServices`) *and* enabled in the Cloud project. Their typings
  are optional, hence `AdminDirectory.Users!.insert(...)`.
- **No tree-shaking.** The bundle is built with `--no-treeshake` on purpose: the
  runtime resolves some things by name, and a few dead helpers are cheaper than a
  trigger that silently disappeared.
- **Execution quotas are real.** 6 min per execution (30 on Workspace), 20 000
  UrlFetch calls a day. Long jobs belong in a queue drained by a timer.

## License

MIT — see [LICENSE](LICENSE).
