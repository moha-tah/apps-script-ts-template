import { getEnv, isTestMode, requireEnv } from './get-env'

// Outside the Apps Script runtime PropertiesService does not exist, so getEnv
// falls back to process.env — which is what makes this code unit-testable.
describe('getEnv', () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it('reads from process.env when Apps Script is not available', () => {
    process.env.EXAMPLE_KEY = 'value'
    expect(getEnv('EXAMPLE_KEY')).toBe('value')
  })

  it('returns null for a missing key', () => {
    delete process.env.EXAMPLE_KEY
    expect(getEnv('EXAMPLE_KEY')).toBeNull()
  })

  it('throws for a missing required key', () => {
    delete process.env.EXAMPLE_KEY
    expect(() => requireEnv('EXAMPLE_KEY')).toThrow(/EXAMPLE_KEY/)
  })

  it('detects test mode from TEST', () => {
    process.env.TEST = 'true'
    expect(isTestMode()).toBe(true)
    process.env.TEST = 'false'
    expect(isTestMode()).toBe(false)
  })
})
