/**
 * Testy běží v Node a pokrývají jen to, co nezávisí na telefonu:
 * doménu, datovou vrstvu (přes better-sqlite3) a služby (s falešným
 * úložištěm klíčů). Obrazovky se testují ručně podle docs/QA.md.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, module: 'commonjs', target: 'es2022', rootDir: '.', ignoreDeprecations: '6.0', isolatedModules: true } }],
    '^.+\\.m?js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'commonjs', target: 'es2022', rootDir: '.', ignoreDeprecations: '6.0', isolatedModules: true } }],
  },
  transformIgnorePatterns: ['/node_modules/(?!@noble/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@noble/hashes/(.*)\\.js$': '<rootDir>/node_modules/@noble/hashes/$1.js',
    '^@noble/ciphers/(.*)\\.js$': '<rootDir>/node_modules/@noble/ciphers/$1.js',
  },
};
