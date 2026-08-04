/**
 * Builds every app (or one, with `pnpm run build <app>`):
 *
 *   apps/<app>/src/**  --rollup-->  apps/<app>/dist/index.js
 *   apps/<app>/appsscript.json  --copy-->  apps/<app>/dist/appsscript.json
 *
 * dist/ is exactly what `clasp push` uploads, so the manifest has to be in there.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, rmSync } from 'node:fs'

import { ROOT, appPath, listApps, relPath, fail } from './apps.mjs'

const args = process.argv.slice(2)
const cleanOnly = args.includes('--clean')
const only = args.find(arg => !arg.startsWith('-'))

const apps = only ? [only] : listApps()

if (only && !listApps().includes(only)) {
  fail(`Unknown app "${only}". Available: ${listApps().join(', ') || '(none)'}`)
}

for (const app of apps) {
  rmSync(appPath(app, 'dist'), { recursive: true, force: true })
}

if (cleanOnly) {
  console.log(`Cleaned dist/ for ${apps.length} app(s).`)
  process.exit(0)
}

if (apps.length === 0) {
  console.log('Nothing to build — no app in apps/ yet.')
  console.log('Create one with: pnpm run new <app-name>')
  process.exit(0)
}

const rollup = spawnSync(
  process.platform === 'win32' ? 'rollup.cmd' : 'rollup',
  ['--no-treeshake', '-c', 'rollup.config.mjs'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(only ? { GAS_ONLY_APP: only } : {}) },
    shell: process.platform === 'win32',
  }
)

if (rollup.status !== 0) process.exit(rollup.status ?? 1)

for (const app of apps) {
  const manifest = appPath(app, 'appsscript.json')
  if (!existsSync(manifest)) {
    fail(
      `apps/${app}/appsscript.json is missing — Apps Script needs a manifest.\n` +
        `  Copy one from templates/app/appsscript.json.`
    )
  }
  const target = appPath(app, 'dist', 'appsscript.json')
  copyFileSync(manifest, target)
  console.log(`✓ ${app} → ${relPath(target)}`)
}
