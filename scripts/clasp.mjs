/**
 * Thin wrapper around clasp that knows about apps/.
 *
 *   node scripts/clasp.mjs push   <app>   build + upload to the Apps Script editor
 *   node scripts/clasp.mjs deploy <app>   push + create/update a versioned deployment
 *   node scripts/clasp.mjs open   <app>   open the project in the Apps Script editor
 *   node scripts/clasp.mjs logs   <app>   tail Cloud Logging output
 *
 * Everything after `--` is forwarded to clasp untouched.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import dotenv from 'dotenv'

import { ROOT, envPrefix, fail, readClaspConfig, requireApp } from './apps.mjs'

dotenv.config({ path: join(ROOT, '.env'), quiet: true })

const [command, ...rest] = process.argv.slice(2)
const separator = rest.indexOf('--')
const forwarded = separator === -1 ? [] : rest.slice(separator + 1)
const positional = (separator === -1 ? rest : rest.slice(0, separator)).filter(
  arg => !arg.startsWith('-')
)

const COMMANDS = ['push', 'deploy', 'open', 'logs']
if (!COMMANDS.includes(command)) {
  fail(
    `Usage: node scripts/clasp.mjs <${COMMANDS.join('|')}> [app] [-- clasp args]`
  )
}

const app = requireApp(positional[0])
const projectDir = join('apps', app)

const config = readClaspConfig(app)
if (!config) {
  fail(
    `apps/${app}/.clasp.json is missing. Recreate it with:\n\n` +
      `  pnpm run new ${app} --create --type sheets\n`
  )
}
if (!config.scriptId) {
  fail(
    `apps/${app}/.clasp.json has no scriptId yet.\n\n` +
      `  Create a new Apps Script project:\n` +
      `    pnpm exec clasp -P ${projectDir} create-script --type standalone --title "${app}"\n\n` +
      `  ...or paste the id of an existing one (Apps Script editor → Project Settings).`
  )
}

/** Runs clasp with the app's project file, streaming output. */
function clasp(args) {
  const result = spawnSync(
    process.platform === 'win32' ? 'clasp.cmd' : 'clasp',
    ['-P', projectDir, ...args],
    { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }
  )
  if (result.error) fail(`Could not run clasp: ${result.error.message}`)
  if (result.status !== 0) process.exit(result.status ?? 1)
}

/** Builds the app before anything is uploaded. */
function build() {
  const result = spawnSync(process.execPath, ['scripts/build.mjs', app], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
  const bundle = join(ROOT, 'apps', app, 'dist', 'index.js')
  if (!existsSync(bundle)) fail(`Build produced no ${bundle}.`)
}

/**
 * Deployment id resolution, in order:
 *   1. CLASP_DEPLOYMENTS — a JSON map {"app-name": "AKfycb..."} (used by CI)
 *   2. <APP>_DEPLOYMENT_ID — one variable per app (used locally, from .env)
 *   3. nothing — a brand new deployment is created, and its id is printed
 *
 * Reusing an id is what keeps a web app URL stable across deployments.
 */
function resolveDeploymentId() {
  const map = process.env.CLASP_DEPLOYMENTS
  if (map) {
    try {
      const parsed = JSON.parse(map)
      if (parsed[app]) return parsed[app]
    } catch (error) {
      fail(`CLASP_DEPLOYMENTS is not valid JSON: ${error.message}`)
    }
  }
  return process.env[`${envPrefix(app)}_DEPLOYMENT_ID`] || null
}

switch (command) {
  case 'push': {
    build()
    // -f also pushes appsscript.json changes instead of prompting.
    clasp(['push', '-f', ...forwarded])
    console.log(`\n✓ ${app} pushed. The editor now runs this code.`)
    console.log(
      '  Web apps keep serving the DEPLOYED version — run `pnpm run deploy` for those.'
    )
    break
  }

  case 'deploy': {
    build()
    clasp(['push', '-f'])
    const deploymentId = resolveDeploymentId()
    const description = `${app} — ${new Date().toISOString().slice(0, 16)}`
    if (deploymentId) {
      clasp(['deploy', '-i', deploymentId, '-d', description, ...forwarded])
      console.log(`\n✓ ${app} redeployed (${deploymentId}) — URL unchanged.`)
    } else {
      console.log(
        `\nNo deployment id for "${app}" — creating a new deployment.\n` +
          `Save the id printed below as ${envPrefix(app)}_DEPLOYMENT_ID in .env,\n` +
          `otherwise the next deploy creates yet another URL.\n`
      )
      clasp(['deploy', '-d', description, ...forwarded])
    }
    break
  }

  case 'open':
    clasp(['open-script', ...forwarded])
    break

  case 'logs':
    clasp(['tail-logs', ...forwarded])
    break
}
