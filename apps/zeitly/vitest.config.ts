import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts'], testTimeout: 60000, hookTimeout: 60000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), 'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts') } },
});
