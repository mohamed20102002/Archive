import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Directory containing E2E tests
  testDir: './src/test/e2e',

  // Test file pattern
  testMatch: '**/*.e2e.ts',

  // Run tests in parallel
  fullyParallel: false, // Electron tests should run sequentially

  // Fail fast on CI
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Single worker for Electron (one app instance at a time)
  workers: 1,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }]
  ],

  // Global timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000
  },

  // Shared settings for all tests
  use: {
    // Record trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure'
  },

  // Output directory for artifacts
  outputDir: 'test-results',

  // Project configuration for Electron
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.e2e.ts'
    }
  ]
})
