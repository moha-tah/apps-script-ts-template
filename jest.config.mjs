/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/templates/'],
  moduleNameMapper: {
    '^@shared$': '<rootDir>/libs/shared/index.ts',
    '^@shared/(.*)$': '<rootDir>/libs/shared/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }],
  },
}
