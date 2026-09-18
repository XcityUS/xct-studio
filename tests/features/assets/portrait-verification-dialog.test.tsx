import { PortraitVerificationDialog } from '@/features/assets/components/AssetsPanel/PortraitVerificationDialog';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/Dialog', () => ({
    Dialog: ({ children }: { children: ReactNode }) => <div role='dialog'>{children}</div>,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>
}));

describe('portrait verification dialog', () => {
    it('shows a waiting dialog without embedding the provider page or exposing its URL', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='zh' messages={zh} timeZone='UTC'>
                <PortraitVerificationDialog open error={null} onClose={() => {}} onRestartInNewWindow={() => {}} />
            </NextIntlClientProvider>
        );

        expect(html).toContain('role="dialog"');
        expect(html).toContain('认证真人');
        expect(html).toContain('在新窗口重新认证');
        expect(html).not.toContain('<iframe');
        expect(html).not.toContain('https://verify.example.com');
    });
});
