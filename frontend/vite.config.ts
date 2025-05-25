/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom', // or 'jsdom'
    setupFiles: './src/setupTests.ts', // Optional setup file
    css: true, // If you want to test CSS (e.g., with @testing-library/jest-dom `toHaveStyle`)
    reporters: ['verbose'], // Or '@vitest/ui' if you installed it and want the UI
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx', // Typically don't test the main entry point
        'src/vite-env.d.ts',
        'src/**/*.test.{ts,tsx}', // Exclude test files from coverage
        'src/setupTests.ts',
      ],
    },
  },
  // server: { // If you need proxy for backend API calls during dev
  //   proxy: {
  //     '/api': {
  //       target: 'http://localhost:3000', // Your backend server
  //       changeOrigin: true,
  //     },
  //   },
  // },
});
