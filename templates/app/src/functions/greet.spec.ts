import { greet } from './greet'

describe('greet', () => {
  it('greets a name', () => {
    expect(greet('Ada')).toBe('Hello, Ada!')
  })

  it('falls back to the world', () => {
    expect(greet('   ')).toBe('Hello, world!')
  })
})
