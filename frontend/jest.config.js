export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.jsx'],
  transform: { '^.+\\.jsx?$': 'babel-jest' },
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-dom']
}
