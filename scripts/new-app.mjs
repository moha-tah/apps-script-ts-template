/**
 * Scaffolds a new Apps Script project in apps/<name>.
 *
 *   pnpm run new my-app                            files only, scriptId filled in later
 *   pnpm run new my-app --create --type sheets     also creates the project on Google
 *   pnpm run new my-app --script-id 1kOb...        wires an existing project
 *
 * --type is passed straight to `clasp create-script`:
 *   standalone | sheets | docs | slides | forms | webapp | api
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

import { ROOT, appPath, envPrefix, fail } from './apps.mjs'

const VALUE_FLAGS = ['--type', '--script-id', '--title']

/** Parses `<name> [--flag value] [--create]` without pulling in a CLI library. */
function parseArgs(argv) {
  const parsed = { positional: [], options: {}, create: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (VALUE_FLAGS.includes(arg)) {
      parsed.options[arg] = argv[++index]
    } else if (arg === '--create') {
      parsed.create = true
    } else if (arg.startsWith('-')) {
      fail(`Unknown option "${arg}".`)
    } else {
      parsed.positional.push(arg)
    }
  }
  return parsed
}

const {
  positional,
  options,
  create: shouldCreate,
} = parseArgs(process.argv.slice(2))

const name = positional[0]
const type = options['--type'] || 'standalone'
const title = options['--title'] || name
let scriptId = options['--script-id'] || ''

if (!name) {
  fail(
    'Usage: pnpm run new <app-name> [--create] [--type standalone|sheets|docs|slides|forms|webapp|api]\n' +
      '                          [--script-id <existing id>] [--title "Human title"]'
  )
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  fail(`"${name}" must be kebab-case (lowercase letters, digits and dashes).`)
}
if (existsSync(appPath(name))) {
  fail(`apps/${name} already exists.`)
}

const TEMPLATE_DIR = join(ROOT, 'templates', 'app')

/** Copies templates/app into apps/<name>, substituting placeholders. */
function copyTemplate(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (entry.isDirectory()) {
      copyTemplate(source, target)
      continue
    }
    const content = readFileSync(source, 'utf8')
      .split('__APP_NAME__')
      .join(name)
      .split('__APP_TITLE__')
      .join(title)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
}

copyTemplate(TEMPLATE_DIR, appPath(name))

// `clasp create-script` writes its own .clasp.json in the project directory;
// we only keep the scriptId out of it and write a canonical file ourselves.
if (shouldCreate) {
  console.log(`\nCreating a "${type}" Apps Script project on Google...\n`)
  const result = spawnSync(
    process.platform === 'win32' ? 'clasp.cmd' : 'clasp',
    [
      '-P',
      join('apps', name),
      'create-script',
      '--type',
      type,
      '--title',
      title,
    ],
    { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }
  )
  if (result.status !== 0) {
    console.error(
      '\n✖ clasp could not create the project (are you logged in? `pnpm exec clasp login`).\n' +
        `  apps/${name} was still scaffolded — add its scriptId to apps/${name}/.clasp.json.\n`
    )
  } else {
    // Depending on the clasp version the generated project file lands in the
    // project directory or in the repo root; take the scriptId from wherever it
    // is and leave no stray file behind — ours is written just below.
    for (const generated of [
      join(appPath(name), '.clasp.json'),
      join(ROOT, '.clasp.json'),
    ]) {
      if (!existsSync(generated)) continue
      const found = JSON.parse(readFileSync(generated, 'utf8')).scriptId
      if (found) scriptId = found
      if (generated === join(ROOT, '.clasp.json')) rmSync(generated)
      if (scriptId) break
    }
    if (!scriptId) {
      console.error(
        '\n✖ clasp reported success but no scriptId was written — add it by hand.\n'
      )
    }
  }
}

writeFileSync(
  join(appPath(name), '.clasp.json'),
  `${JSON.stringify(
    {
      scriptId,
      rootDir: 'dist',
      scriptExtensions: ['.js', '.gs'],
      htmlExtensions: ['.html'],
      jsonExtensions: ['.json'],
      filePushOrder: [],
      skipSubdirectories: false,
    },
    null,
    2
  )}\n`
)

console.log(`\n✓ apps/${name} created.\n`)
console.log('Next steps:')
let step = 1
if (!scriptId) {
  console.log(
    `  ${step++}. Give it a scriptId — either\n` +
      `       pnpm exec clasp -P apps/${name} create-script --type ${type} --title "${title}"\n` +
      `     or paste an existing one into apps/${name}/.clasp.json\n` +
      `     (Apps Script editor → Project Settings → Script ID).`
  )
}
console.log(`  ${step++}. pnpm run build ${name}`)
console.log(`  ${step++}. pnpm run push ${name}`)
console.log(
  `  ${step++}. For a web app: pnpm run deploy ${name}, then store the printed id\n` +
    `     as ${envPrefix(name)}_DEPLOYMENT_ID in .env so the URL stays stable.\n`
)
