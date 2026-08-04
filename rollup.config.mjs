import alias from '@rollup/plugin-alias'
import typescript from '@rollup/plugin-typescript'
import cleanup from 'rollup-plugin-cleanup'
import prettier from 'rollup-plugin-prettier'
import { fileURLToPath } from 'node:url'

import { listApps, appPath } from './scripts/apps.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))

// `pnpm run build <app>` narrows the build to a single app.
const only = process.env.GAS_ONLY_APP
const apps = listApps().filter(app => !only || app === only)

// One Rollup config per app: each bundles apps/<app>/src/index.ts into a single
// apps/<app>/dist/index.js that the Apps Script runtime can execute as-is.
export default apps.map(app => ({
  input: appPath(app, 'src/index.ts'),
  output: {
    dir: appPath(app, 'dist'),
    format: 'esm',
    entryFileNames: 'index.js',
    // Apps Script has no module system: everything must land in one file.
    inlineDynamicImports: true,
  },
  plugins: [
    alias({
      entries: [
        { find: '@shared', replacement: `${root}libs/shared/index.ts` },
        { find: /^@shared\/(.*)$/, replacement: `${root}libs/shared/$1` },
      ],
    }),
    typescript({
      tsconfig: './tsconfig.json',
      noEmit: false,
      outDir: appPath(app, 'dist'),
      declaration: false,
      include: [`apps/${app}/src/**/*.ts`, 'libs/**/*.ts'],
    }),
    cleanup({ comments: 'none', extensions: ['.ts'] }),
    prettier({ parser: 'typescript' }),
  ],
  // Apps Script code is not a module: `this` at top level must not be rewritten.
  context: 'this',
  onwarn(warning, warn) {
    if (warning.code === 'EMPTY_BUNDLE') return
    warn(warning)
  },
}))
