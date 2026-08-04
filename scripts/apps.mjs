/**
 * Single source of truth for "what is an app in this repo".
 *
 * An app is any directory under apps/ that has a src/index.ts. Everything else
 * (build, push, deploy, CI matrix) derives from this list, so adding a script
 * means creating a folder — no config to edit.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const APPS_DIR = join(ROOT, 'apps')

/** Every app in the repo, alphabetically. */
export function listApps() {
  if (!existsSync(APPS_DIR)) return []
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => existsSync(join(APPS_DIR, name, 'src', 'index.ts')))
    .sort()
}

/** Absolute path inside an app: appPath('my-app', 'dist') */
export function appPath(app, ...segments) {
  return join(APPS_DIR, app, ...segments)
}

/** Path relative to the repo root, with forward slashes (for logs and Rollup). */
export function relPath(absolute) {
  return absolute
    .slice(ROOT.length + 1)
    .split('\\')
    .join('/')
}

/** Reads apps/<app>/.clasp.json, or null when it does not exist yet. */
export function readClaspConfig(app) {
  const file = appPath(app, '.clasp.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(
      `apps/${app}/.clasp.json is not valid JSON: ${error.message}`
    )
  }
}

/** my-web-app -> MY_WEB_APP (used for per-app environment variables). */
export function envPrefix(app) {
  return app.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()
}

/**
 * Resolves an app name from a CLI argument, failing with a helpful message.
 * With a single app in the repo, the argument can be omitted.
 */
export function requireApp(name) {
  const apps = listApps()
  if (apps.length === 0) {
    fail(
      'No app found in apps/. Create one with:\n\n  pnpm run new <app-name>\n'
    )
  }
  if (!name) {
    if (apps.length === 1) return apps[0]
    fail(`Which app? Available: ${apps.join(', ')}`)
  }
  if (!apps.includes(name)) {
    fail(`Unknown app "${name}". Available: ${apps.join(', ') || '(none)'}`)
  }
  return name
}

export function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

// `pnpm run apps` — list what this repo contains.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const apps = listApps()
  if (apps.length === 0) {
    console.log('No app yet. Create one with: pnpm run new <app-name>')
  } else {
    for (const app of apps) {
      const config = readClaspConfig(app)
      const scriptId = config?.scriptId
      console.log(
        `${app.padEnd(24)} ${scriptId ? scriptId : '(no scriptId — see README)'}`
      )
    }
  }
}
