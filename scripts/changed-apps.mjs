/**
 * Prints the apps a CI run should deploy, as GitHub Actions step output:
 *
 *   apps=["my-app","other-app"]
 *   count=2
 *
 * Only apps whose files changed are deployed — unless something shared changed
 * (libs/, scripts/, root config), in which case everything is rebuilt, because a
 * shared change can alter every bundle.
 *
 *   node scripts/changed-apps.mjs --base <sha> [--head <sha>] [--only <app>]
 */
import { spawnSync } from 'node:child_process'

import { ROOT, listApps } from './apps.mjs'

const args = process.argv.slice(2)
const option = flag => {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1] || null
}

const apps = listApps()
const only = option('--only')
const base = option('--base')
const head = option('--head') || 'HEAD'

/** Files changed between two refs, or null when git cannot tell us. */
function changedFiles() {
  if (!base || /^0+$/.test(base)) return null
  const result = spawnSync('git', ['diff', '--name-only', `${base}..${head}`], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (result.status !== 0) return null
  return result.stdout.split('\n').filter(Boolean)
}

function selected() {
  if (only) return apps.includes(only) ? [only] : []
  const files = changedFiles()
  // No usable diff (first push, force push, manual run) → deploy everything.
  if (!files) return apps

  const sharedChanged = files.some(file => !file.startsWith('apps/'))
  if (sharedChanged) return apps

  return apps.filter(app => files.some(file => file.startsWith(`apps/${app}/`)))
}

const result = selected()
console.log(`apps=${JSON.stringify(result)}`)
console.log(`count=${result.length}`)
