// Version: 1.0072
// Jest setup file - adds Mocha compatibility
// Maps Mocha hooks (before, after) to Jest equivalents (beforeAll, afterAll)

global.before = beforeAll;
global.after = afterAll;
// beforeEach and afterEach already exist in both
