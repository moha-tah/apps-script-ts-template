/**
 * Publishes functions to the Apps Script runtime.
 *
 * Rollup bundles the whole app into one file, so nothing is global by default.
 * Anything the runtime has to find by name — trigger handlers (`onOpen`,
 * `onFormSubmit`), menu callbacks, web app entry points (`doGet`, `doPost`),
 * functions you want to run from the editor — must be attached to `globalThis`.
 *
 *   expose({ onOpen, doGet, refreshCache })
 *
 * Call it once, at the bottom of the app's src/index.ts.
 */
export function expose(functions: Record<string, unknown>): void {
  Object.assign(globalThis, functions)
}
