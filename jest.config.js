// Test coverage configuration
// jest.config.js
module.exports = {
    collectCoverageFrom: [
      'src/**/*.{js,jsx}',
      '!src/index.js',
      '!src/reportWebVitals.js',
      '!src/setupTests.js',
      '!src/**/*.test.{js,jsx}',
      '!src/**/*.stories.{js,jsx}',
    ],
    coverageReporters: ['text', 'lcov', 'html'],
    coverageDirectory: 'coverage',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    moduleNameMapping: {
      '^@/(.*)$': '<rootDir>/src/$1',
    },
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
      '<rootDir>/src/**/*.{test,spec}.{js,jsx}'
    ],
    transformIgnorePatterns: [
      'node_modules/(?!(.*\\.mjs$|@supabase|openai))'
    ]
  };