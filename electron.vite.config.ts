import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      include: ['node-llama-cpp']
    })],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        },
        output: {
          manualChunks: {
            // Core React dependencies
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // TanStack Query
            'vendor-query': ['@tanstack/react-query'],
            // 3D graphics (large bundle)
            'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
            // Charts
            'vendor-charts': ['recharts'],
            // Date utilities
            'vendor-date': ['date-fns'],
            // Document generation
            'vendor-docs': ['docx', 'pdfmake', 'xlsx']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    }
  }
})
