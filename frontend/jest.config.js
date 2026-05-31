export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.jsx'],
  transform: { '^.+\\.jsx?$': 'babel-jest' },
  setupFilesAfterEnv: ['@testing-library/jest-dom']
}
