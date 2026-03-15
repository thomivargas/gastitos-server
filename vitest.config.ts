import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@middlewares': path.resolve(__dirname, 'src/middlewares'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@jobs': path.resolve(__dirname, 'src/jobs'),
    },
  },
});
