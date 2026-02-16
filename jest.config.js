// Version: 1.0072
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/chat/**/*.test.js'],
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
  restoreMocks: true,
  modulePathIgnorePatterns: ['<rootDir>/tests/chat/package.json', '<rootDir>/tests/mobile-chat/package.json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
