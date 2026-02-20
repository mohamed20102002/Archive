import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Environment for tests
    environment: 'jsdom',

    // Setup files to run before each test file
    setupFiles: ['./src/test/setup.ts'],

    // Global test settings
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'out/**',
        '**/*.d.ts',
        'src/test/**',
        '**/*.config.*',
        '**/index.ts', // Barrel files
      ],
      // Target 80% coverage
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    },

    // Test file patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'out', '.git'],

    // Reporter configuration
    reporters: ['default', 'html'],

    // Timeout for each test
    testTimeout: 10000,

    // Thread pool settings
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true // Required for better-sqlite3 compatibility
      }
    },

    // Dependencies that need to be pre-transformed
    deps: {
      inline: ['electron']
    },

    // Alias configuration (matches your project structure)
    alias: {
      '@main': resolve(__dirname, './src/main'),
      '@renderer': resolve(__dirname, './src/renderer'),
      '@preload': resolve(__dirname, './src/preload'),
      '@test': resolve(__dirname, './src/test')
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@main': resolve(__dirname, './src/main'),
      '@renderer': resolve(__dirname, './src/renderer'),
      '@preload': resolve(__dirname, './src/preload'),
      '@test': resolve(__dirname, './src/test')
    }
  }
})
