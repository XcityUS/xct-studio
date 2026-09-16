import { AssetBindingPicker } from '@/features/generation/components/CreationForm/StoryboardDraftPanel/AssetBindingPicker';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import type { ProjectAsset } from '@/shared/contracts/production';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const asset: ProjectAsset = {
    id: 'image-1',
    projectId: 'project-1',
    name: 'City scene',
    kind: 'image',
    status: 'active',
    sourceType: 'upload',
    providerAssetId: 'asset-private-123',
    createdAt: 1,
    updatedAt: 1
};

function render(assetId?: string, locale: 'en' | 'zh' = 'en', assets: ProjectAsset[] = [asset]) {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <AssetBindingPicker assetId={assetId} ariaLabel='Scene asset' assets={assets} onCommit={() => {}} />
        </NextIntlClientProvider>
    );
}

describe('storyboard asset binding UI', () => {
    it('selects an approved asset by name without showing an ID textbox', () => {
        const html = render('asset-private-123');
        expect(html).toContain('City scene');
        expect(html).not.toContain('Paste asset ID');
        expect(html).not.toContain('<input');
    });

    it('keeps an older binding visible even when its project asset is not in the current list', () => {
        expect(render('previous-asset', 'zh')).toContain('当前绑定的素材');
    });

    it('marks a known revoked binding unavailable without revealing its ID', () => {
        const html = render('asset-private-123', 'zh', [{ ...asset, status: 'revoked' }]);
        expect(html).toContain('素材已不可用，请重新选择');
        expect(html).not.toContain('asset-private-123</');
    });
});
