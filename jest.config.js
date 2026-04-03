module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['server.js'],
  coverageThreshold: {
    global: {
      lines: 100,
      statements: 100,
      functions: 100,
      branches: 100,
    },
  },
};
