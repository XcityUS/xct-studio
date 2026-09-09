import { AccountConnection } from '@/features/settings/components/AccountConnection';
import { XCITY_LOGIN_URL } from '@/features/settings/sso';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function render(checking: boolean, error: string | null = null, locale: 'en' | 'zh' = 'en') {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <AccountConnection checking={checking} error={error} onRetry={() => {}} onConfigure={() => {}} />
        </NextIntlClientProvider>
    );
}

describe('account connection presentation', () => {
    it('shows localized progress without sign-in actions while checking', () => {
        const html = render(true);
        expect(html).toContain('Connecting your Xcity account...');
        expect(html).toContain('Fetching your TokenHub key from xcity.ai');
        expect(html).not.toContain('<button');
        expect(html).not.toContain('Sign in with Xcity');
    });

    it('retains the sign-in link, retry, and manual-key actions without performing authentication', () => {
        const html = render(false);
        expect(html).toContain(`href="${XCITY_LOGIN_URL}"`);
        expect(html).toContain('Retry');
        expect(html).toContain('Use an API key instead');
        expect(html.match(/<button/g)).toHaveLength(2);
    });

    it('renders Chinese copy and escapes error content', () => {
        const html = render(false, '<script>bad</script>', 'zh');
        expect(html).toContain(zh['Sign in with Xcity']);
        expect(html).toContain(zh['Retry']);
        expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
        expect(html).not.toContain('<script>');
    });
});
