# apps/

One directory per Apps Script project. Nothing here is registered anywhere: an
app is simply a folder that contains `src/index.ts`, and the build, push, deploy
and CI matrix all derive from that (see `scripts/apps.mjs`).

Create one:

```bash
pnpm run new my-app                          # files only
pnpm run new my-app --create --type sheets   # also creates the project on Google
```

Each app owns:

```
apps/my-app/
├── .clasp.json        # scriptId of the Apps Script project + rootDir: dist
├── appsscript.json    # manifest: timezone, scopes, advanced services, webapp
├── src/index.ts       # entry point — expose() what the runtime must see
└── dist/              # generated bundle, what clasp uploads (git-ignored)
```

Apps are independent: separate script ids, separate Script Properties, separate
deployments. Share code through `libs/shared` (`import { … } from '@shared'`).
