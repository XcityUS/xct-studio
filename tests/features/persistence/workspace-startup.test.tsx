import { WorkspaceStartup } from '@/features/persistence/components/WorkspaceStartup';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function render(locale: 'en' | 'zh', migrating: boolean) {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <WorkspaceStartup
                stage='import'
                stageLabel={locale === 'en' ? 'Importing records' : '正在导入记录'}
                progress={48}
                migrating={migrating}
                elapsed={12}
                processed={4}
                total={9}
            />
        </NextIntlClientProvider>
    );
}

describe('workspace startup presentation', () => {
    it('uses an indeterminate premium startup state for ordinary visits', () => {
        const html = render('en', false);
        expect(html).toContain('Preparing your creative workspace');
        expect(html).toContain('Workspace sync is active');
        expect(html).toContain('<progress');
        expect(html).not.toContain('value="48"');
    });

    it('shows numeric migration progress and localized copy', () => {
        const html = render('zh', true);
        expect(html).toContain('正在准备你的创作空间');
        expect(html).toContain('48%');
        expect(html).toContain('value="48"');
        expect(html).toContain('已迁移 4/9 条记录');
    });
});
