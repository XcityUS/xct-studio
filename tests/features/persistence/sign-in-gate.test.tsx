import { SignInGate } from '@/features/persistence/components/SignInGate';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function render(locale: 'en' | 'zh', checkingAuth: boolean, allowManualApiKey = false) {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <SignInGate
                checkingAuth={checkingAuth}
                loginHref='https://xcity.ai/login?return_to=studio'
                allowManualApiKey={allowManualApiKey}
                onConfigure={() => undefined}
            />
        </NextIntlClientProvider>
    );
}

describe('sign-in workspace entry', () => {
    it('shows a focused login action after the session check', () => {
        const html = render('zh', false);
        expect(html).toContain('把灵感，变成影像');
        expect(html).toContain('创作视频、管理项目与素材，都在同一个工作台。');
        expect(html).toContain('href="https://xcity.ai/login?return_to=studio"');
        expect(html).toContain('登录 Xcity');
        expect(html).not.toContain('使用 API 密钥');
    });

    it('does not offer login while the session is still being checked', () => {
        const html = render('en', true, true);
        expect(html).toContain('Loading your workspace');
        expect(html).not.toContain('href="https://xcity.ai/login?return_to=studio"');
        expect(html).not.toContain('Use an API key instead');
    });

    it('keeps the manual-key option when enabled', () => {
        expect(render('en', false, true)).toContain('Use an API key instead');
    });
});
