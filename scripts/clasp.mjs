/**
 * Thin wrapper around clasp that knows about apps/.
 *
 *   node scripts/clasp.mjs push   <app>   build + upload to the Apps Script editor
 *   node scripts/clasp.mjs deploy <app>   push + create/update a versioned deployment
 *   node scripts/clasp.mjs open   <app>   open the project in the Apps Script editor
 *   node scripts/clasp.mjs logs   <app>   tail Cloud Logging output
 *
 * Options:
 *   --no-new-deployment   deploy: when no deployment id is stored, push and
 *                         stop instead of minting a brand new deployment.
 *                         Set by CI — see .github/workflows/deploy.yaml.
 *
 * Everything after `--` is forwarded to clasp untouched.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import dotenv from 'dotenv'

import {
  ROOT,
  fail,
  readClaspConfig,
  readDeployments,
  requireApp,
  servesADeployedVersion,
} from './apps.mjs'

dotenv.config({ path: join(ROOT, '.env'), quiet: true })

const OPTIONS = ['--no-new-deployment']

const [command, ...rest] = process.argv.slice(2)
const separator = rest.indexOf('--')
const forwarded = separator === -1 ? [] : rest.slice(separator + 1)
const ours = separator === -1 ? rest : rest.slice(0, separator)
const positional = ours.filter(arg => !arg.startsWith('-'))
const flags = ours.filter(arg => arg.startsWith('-'))

const COMMANDS = ['push', 'deploy', 'open', 'logs']
if (!COMMANDS.includes(command)) {
  fail(
    `Usage: node scripts/clasp.mjs <${COMMANDS.join('|')}> [app] [options] [-- clasp args]`
  )
}

// A mistyped option must not be ignored: --no-new-deployment is what stops CI
// from creating a deployment per run, so silently dropping it would bring back
// the exact problem it exists to prevent.
for (const flag of flags) {
  if (!OPTIONS.includes(flag)) {
    fail(
      `Unknown option "${flag}". Known options: ${OPTIONS.join(', ')}.\n` +
        `  Arguments meant for clasp itself go after a "--" separator.`
    )
  }
}

const noNewDeployment = flags.includes('--no-new-deployment')

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
 *   1. CLASP_DEPLOYMENTS — a JSON map {"app-name": "AKfycb..."}, the override
 *      for a one-off deploy or an id somebody would rather not commit
 *   2. deployments.json — the normal place, committed with the code
 *   3. nothing — a brand new deployment is created, and its id is printed
 *
 * Environment wins over the file. Reusing an id is what keeps a web app URL
 * stable across deployments.
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

  return readDeployments()[app] || null
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
      break
    }

    // Creating a deployment mints a URL that then has to be stored somewhere,
    // so it is a bootstrap step a human does once, knowingly. Repeating it on
    // every CI run would pile up deployments for apps that never needed one —
    // hence the flag the CD workflow passes.
    if (noNewDeployment) {
      console.log(
        `\n✓ ${app} pushed. No deployment id stored and --no-new-deployment is` +
          ` set, so no version was published.`
      )
      if (servesADeployedVersion(app)) {
        console.warn(
          `\n⚠ ${app} declares a web app / API executable in its manifest: it` +
            ` serves the DEPLOYED version, so this push changed nothing for` +
            ` its users.\n` +
            `  Deploy it once by hand (pnpm run deploy ${app}), then add the` +
            ` printed id to deployments.json:\n` +
            `    { "${app}": "AKfycb..." }`
        )
      } else {
        console.log(
          `  Its manifest declares no web app, so the editor code is all there` +
            ` is to update — nothing else to do.`
        )
      }
      break
    }

    console.log(
      `\nNo deployment id for "${app}" — creating a new deployment.\n` +
        `Add the id printed below to deployments.json:\n` +
        `  { "${app}": "AKfycb..." }\n` +
        `otherwise the next deploy creates yet another URL.\n`
    )
    clasp(['deploy', '-d', description, ...forwarded])
    break
  }

  case 'open':
    clasp(['open-script', ...forwarded])
    break

  case 'logs':
    clasp(['tail-logs', ...forwarded])
    break
}
