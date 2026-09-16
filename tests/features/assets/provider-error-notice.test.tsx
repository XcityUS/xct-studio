import { ProviderErrorNotice } from '@/features/assets/components/ProviderErrorNotice';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function render(error: string, locale: 'en' | 'zh' = 'en') {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <ProviderErrorNotice error={error} />
        </NextIntlClientProvider>
    );
}

describe('asset error presentation', () => {
    it('does not expose an upstream provider error to the user', () => {
        const html = render('ModelArk private catalog internal error');
        expect(html).toContain('Could not complete the asset action');
        expect(html).not.toContain('ModelArk');
    });

    it('retains a localized rate-limit recovery message', () => {
        expect(render('PROVIDER_RATE_LIMITED', 'zh')).toContain('素材服务暂时繁忙');
    });
});
