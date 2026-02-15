// Version: 1.0056
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/chat/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'private/chat/**/*.js',
    '!private/chat/node_modules/**',
    '!private/chat/tests/**'
  ],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
