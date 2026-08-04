/**
 * Configuration that works both in Apps Script and locally.
 *
 * In production, values come from the script's Script Properties
 * (Apps Script editor → Project Settings → Script Properties). Locally — unit
 * tests, scripts — they come from `process.env` / `.env`. Nothing else in the
 * codebase should touch either source directly.
 */

/** Reads a configuration value, or null when it is not set. */
export function getEnv(key: string): string | null {
  if (typeof PropertiesService !== 'undefined') {
    return PropertiesService.getScriptProperties().getProperty(key)
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? null
  }
  return null
}

/**
 * Reads a configuration value, throwing when it is missing.
 * Use for values the script cannot meaningfully run without.
 */
export function requireEnv(key: string): string {
  const value = getEnv(key)
  if (!value) {
    throw new Error(
      `Missing configuration "${key}". Set it in Project Settings → Script Properties.`
    )
  }
  return value
}

/**
 * True when `TEST` is set to 'true'.
 *
 * A test mode is worth having in Apps Script: there is no staging environment,
 * so the usual pattern is one flag that redirects side effects — mail to your
 * own address, webhooks to a test channel — while everything else runs for real.
 */
export function isTestMode(): boolean {
  return getEnv('TEST') === 'true'
}
