import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    server: {
      // jsdom for DOM-dependent tests (used via @vitest-environment jsdom pragma)
    },
  },
});
