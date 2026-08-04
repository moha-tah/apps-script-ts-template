/**
 * Example of the pattern that makes Apps Script code testable: keep logic in
 * plain functions that take and return values, and let index.ts do the talking
 * to SpreadsheetApp, MailApp & co. Only the latter needs the runtime.
 */
export function greet(name: string): string {
  const trimmed = name.trim()
  return `Hello, ${trimmed || 'world'}!`
}
