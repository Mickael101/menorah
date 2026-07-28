import { defineConfig } from 'vitest/config';

// Harnais minimal : le seul code frontend teste unitairement est le
// controleur de scene, du TypeScript pur sans DOM (canvas et runtime Rive
// injectes). Pas de jsdom, pas de @vue/test-utils : les composants restent
// couverts par vue-tsc + la verification navigateur.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
