// Version: 1.0071
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  rootDir: '../..',
  testMatch: ['<rootDir>/tests/mobile-chat/**/*.test.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  testTimeout: 30000,
  verbose: true
};
