# __APP_TITLE__

<!-- What this script does, what it is bound to, and anything a future reader
     would otherwise have to reverse-engineer from the code. -->

- **Script**: see `.clasp.json` → `scriptId` (`pnpm run open __APP_NAME__` opens the editor)
- **Bound to**: _spreadsheet / form / standalone_
- **Triggers**: `onOpen` (simple trigger, no registration needed)
- **Web app**: `doGet` — needs `pnpm run deploy __APP_NAME__`, not just `pnpm run push`

## Configuration

Script Properties read by this app (locally: `.env`):

| Key | Required | What it is |
| --- | --- | --- |
| `GREETING_NAME` | no | Name used by the _Say hello_ menu item |

## Commands

```bash
pnpm run push __APP_NAME__      # build + upload to the editor
pnpm run deploy __APP_NAME__    # + publish a new version of the web app
pnpm run logs __APP_NAME__      # tail executions
```
