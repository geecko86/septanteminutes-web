import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

// Vitest 4 switched from esbuild to Rolldown as its transform engine.
// Rolldown does not auto-detect JSX from tsconfig.json ("jsx": "preserve")
// the way esbuild did, so we need the React plugin to handle .tsx/.jsx files.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the @/* alias from tsconfig.json so test files can use the same imports as source files
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    // Default environment stays 'node' so pure utility tests stay fast.
    // Tests that need a real DOM (React components, window APIs) opt in with
    // the // @vitest-environment jsdom directive at the top of their file.
    environment: 'node',
    include: ['src/**/*.test.{ts,js,tsx}', 'app/**/*.test.{ts,js,tsx}'],
  },
});
