import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@flipfeeds/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@flipfeeds/game-client/events': path.resolve(__dirname, 'packages/game-client/src/EventBus.ts'),
      '@flipfeeds/game-client': path.resolve(__dirname, 'packages/game-client/src'),
    },
  },
});
