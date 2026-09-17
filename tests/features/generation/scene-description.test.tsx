import { SceneDescription } from '@/features/generation/components/CreationForm/StoryboardDraftPanel/SceneDescription';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function render(description: string, locale: 'en' | 'zh') {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <SceneDescription description={description} />
        </NextIntlClientProvider>
    );
}

describe('scene description copy control', () => {
    it('keeps the full scene description in the preview and offers a localized copy action', () => {
        const description = 'An open-plan office with the entire team leaving after the market closes';
        const html = render(description, 'en');
        expect(html).toContain(description);
        expect(html).toContain('title="' + description + '"');
        expect(html).toContain('aria-label="Copy scene description"');
        expect(render(description, 'zh')).toContain('aria-label="复制场景描述"');
    });

    it('does not offer a copy action for an empty description', () => {
        const html = render('', 'zh');
        expect(html).toContain('暂无描述');
        expect(html).not.toContain('<button');
    });
});
