import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
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
