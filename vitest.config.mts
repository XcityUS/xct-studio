import codspeedPlugin from '@codspeed/vitest-plugin';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [codspeedPlugin()],
    esbuild: { jsx: 'automatic' },
    // Unit tests compile CSS Modules without Next's legacy Tailwind pipeline.
    css: { postcss: { plugins: [] } },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        server: { deps: { inline: ['next-intl'] } },
        benchmark: {
            include: ['bench/**/*.bench.ts']
        }
    }
});
