import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    ...nextVitals,
    ...nextTypescript,
    // Next 16 adds compiler diagnostics to the existing workflow components.
    // Keep their migration debt visible without relaxing checks for new features.
    {
        files: [
            'src/features/post-production/components/AssemblyEditor/index.tsx',
            'src/features/assets/components/AssetsPanel/index.tsx',
            'src/features/generation/components/CreationForm/index.tsx',
            'src/features/generation/components/FinalizeDialog/index.tsx',
            'src/features/community/components/GalleryDetailDialog/index.tsx',
            'src/features/generation/components/ImageStudio/index.tsx',
            'src/features/studio/components/StudioWorkspace/index.tsx',
            'src/features/generation/components/VideoHistoryPanel/index.tsx',
            'src/features/generation/components/VideoHistoryPanel/TileTitle/index.tsx',
            'src/features/generation/components/VideoOutput/CompletedVideoPlayer/index.tsx',
            'src/features/generation/components/VideoOutput/hooks.ts',
            'src/features/generation/hooks/use-video-history.ts',
            'src/features/assets/hooks/use-video-sources.ts',
            'src/features/settings/hooks/use-xcity-key.ts'
        ],
        rules: { 'react-hooks/set-state-in-effect': 'warn' }
    },
    {
        files: [
            'src/features/studio/components/StudioWorkspace/index.tsx',
            'src/features/generation/hooks/use-video-history.ts'
        ],
        rules: { 'react-hooks/refs': 'warn' }
    },
    {
        files: [
            'src/features/studio/components/StudioWorkspace/index.tsx',
            'src/features/generation/components/VideoHistoryPanel/index.tsx'
        ],
        rules: { 'react-hooks/purity': 'warn' }
    },
    globalIgnores([
        '.next/**',
        '.next-dev/**',
        '.next-build/**',
        'out/**',
        'build/**',
        'coverage/**',
        'public/ffmpeg/**',
        'media-worker/.wrangler/**',
        'media-worker/node_modules/**',
        'output/**',
        'next-env.d.ts'
    ])
]);
