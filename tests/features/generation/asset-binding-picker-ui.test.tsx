import { AssetBindingPicker, normalizeManualAssetId } from '@/features/generation/components/CreationForm/StoryboardDraftPanel/AssetBindingPicker';
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
    it('keeps a bound ID in the same editable field and fixed confirmation action', () => {
        const html = render('asset-private-123');
        expect(html).toContain('value="asset-private-123"');
        expect(html).toContain('Confirm');
        expect(html).toContain('disabled');
    });

    it('shows an inline ID input for an unbound storyboard character or scene', () => {
        const html = render();
        expect(html).toContain('Paste asset ID from My assets');
        expect(html).toContain('<input');
        expect(normalizeManualAssetId(' asset://photo-123 ')).toBe('photo-123');
    });

    it('keeps an older binding visible even when its project asset is not in the current list', () => {
        expect(render('previous-asset', 'zh')).toContain('previous-asset');
    });

    it('shows a revoked ID in an editable field with an inline error', () => {
        const html = render('asset-private-123', 'zh', [{ ...asset, status: 'revoked' }]);
        expect(html).toContain('素材授权已撤销，请重新选择');
        expect(html).toContain('value="asset-private-123"');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('确认');
    });

    it('identifies a review-in-progress record instead of calling every nonactive asset unavailable', () => {
        const html = render('asset-private-123', 'zh', [{ ...asset, status: 'reviewing' }]);
        expect(html).toContain('素材审核中，暂不可用');
        expect(html).toContain('aria-invalid="true"');
    });

    it('offers an in-place status query for a reviewing bound asset', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='zh' messages={zh} timeZone='UTC'>
                <AssetBindingPicker assetId='asset-private-123' ariaLabel='角色素材'
                    assets={[{ ...asset, status: 'reviewing' }]} onCommit={() => {}}
                    onRefreshAssetStatus={async () => 'active'} />
            </NextIntlClientProvider>
        );
        expect(html).toContain('刷新状态');
        expect(html).toContain('素材审核中，暂不可用');
    });

    it('shows automatic checks while pending and a manual retry only after twenty attempts', () => {
        const withAttempts = (pollAttempt: number) => renderToStaticMarkup(
            <NextIntlClientProvider locale='zh' messages={zh} timeZone='UTC'>
                <AssetBindingPicker assetId='asset-private-123' ariaLabel='角色素材'
                    assets={[{ ...asset, status: 'reviewing' }]} onCommit={() => {}}
                    onRefreshAssetStatus={async () => 'reviewing'} pollAttempt={pollAttempt} />
            </NextIntlClientProvider>
        );
        expect(withAttempts(3)).toContain('自动查询中（3/20）');
        expect(withAttempts(3)).not.toContain('刷新状态');
        expect(withAttempts(20)).toContain('已查询 20 次，自动刷新暂停');
        expect(withAttempts(20)).toContain('刷新状态');
    });

    it('shows regeneration progress on only the active binding row', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='en' messages={en} timeZone='UTC'>
                <AssetBindingPicker assetId='first' ariaLabel='First' assets={[]} onCommit={() => {}} onRegenerate={() => {}} disabled isRegenerating />
                <AssetBindingPicker assetId='second' ariaLabel='Second' assets={[]} onCommit={() => {}} onRegenerate={() => {}} disabled />
            </NextIntlClientProvider>
        );
        expect(html.match(/lucide-loader-circle/g)).toHaveLength(1);
        expect(html.match(/lucide-wand-sparkles/g)).toHaveLength(1);
    });

    it('offers image generation even when the binding is empty', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='zh' messages={zh} timeZone='UTC'>
                <AssetBindingPicker ariaLabel='角色素材' assets={[]} onCommit={() => {}} onRegenerate={() => {}} generationLabel='生成角色形象图' />
            </NextIntlClientProvider>
        );
        expect(html).toContain('生成角色形象图');
        expect(html).toContain('lucide-wand-sparkles');
    });
});
