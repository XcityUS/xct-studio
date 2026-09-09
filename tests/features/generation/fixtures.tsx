import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import type { VideoJob, VideoMetadata } from '@/shared/contracts/video';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function renderLocalized(children: ReactNode, locale: 'en' | 'zh' = 'en') {
    return renderToStaticMarkup(
        <NextIntlClientProvider
            locale={locale}
            messages={locale === 'en' ? en : zh}
            timeZone='UTC'
            onError={(error) => {
                throw error;
            }}>
            {children}
        </NextIntlClientProvider>
    );
}

export function makeJob(overrides: Partial<VideoJob> = {}): VideoJob {
    return {
        id: 'local-output-fixture',
        object: 'video',
        created_at: 1_783_000_000,
        status: 'completed',
        model: 'seedance-1-5-pro-251215',
        progress: 100,
        seconds: '5',
        size: '16:9',
        prompt: 'Original user prompt: {hero} <close-up>',
        ...overrides
    };
}

export function makeShareItem(overrides: Partial<VideoMetadata> = {}): VideoMetadata {
    return {
        id: 'local-output-fixture',
        timestamp: 1_783_000_000_000,
        filename: 'fixture.mp4',
        durationMs: 5000,
        model: 'seedance-1-5-pro-251215',
        size: '16:9',
        seconds: 5,
        prompt: 'Original user prompt',
        mode: 'create',
        costDetails: null,
        ...overrides
    };
}
