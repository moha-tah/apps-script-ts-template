/**
 * __APP_TITLE__ — entry point.
 *
 * This is the only file the Apps Script runtime really cares about: everything
 * imported here is bundled into a single dist/index.js, and the `expose()` call
 * at the bottom is what makes function names visible to triggers, menus and the
 * web app. Add features as modules under src/ and wire them up here.
 */
import { expose, getEnv } from '@shared'

import { greet } from './functions/greet'

/**
 * Simple trigger: runs when the container document is opened. Simple triggers
 * need no authorization and are not registered anywhere — the runtime just calls
 * the function if it exists. (Remove this for a standalone script.)
 */
function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('__APP_TITLE__')
    .addItem('Say hello', 'sayHello')
    .addToUi()
}

/** Menu callback. Apps Script resolves it by name, hence expose() below. */
function sayHello(): void {
  const name = getEnv('GREETING_NAME') ?? 'world'
  SpreadsheetApp.getUi().alert(greet(name))
}

/** Web app entry point — only reachable once the app is deployed (`pnpm run deploy`). */
function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutput(`<p>${greet('__APP_NAME__')}</p>`)
}

expose({ onOpen, sayHello, doGet })
