import { AssetGrid } from '@/features/assets/components/AssetsPanel/AssetGrid';
import { ReferenceImagesInput } from '@/features/assets/components/ReferenceImagesInput';
import en from '@/i18n/messages/en.json';
import zh from '@/i18n/messages/zh.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function render(locale: 'en' | 'zh') {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : zh} timeZone='UTC'>
            <ReferenceImagesInput
                urls={['https://media.xcity.ai/media/u/user/refs/photo.png']}
                onChange={() => {}}
                maxImages={9}
                declarations={{}}
                approvedAuthorizationIds={new Set()}
                onReviewReferenceAsset={async () => 'asset://approved'}
                showCharacters={false}
            />
        </NextIntlClientProvider>
    );
}

describe('reference review presentation', () => {
    it.each(['en', 'zh'] as const)('keeps the image visible without a source selector in %s', (locale) => {
        const html = render(locale);
        expect(html).toContain('photo.png');
        expect(html).not.toContain('<select');
        expect(html).not.toContain('data-slot="select-trigger"');
        expect(html).not.toContain('Where did these come from?');
        expect(html).not.toContain('这些图片来自哪里？');
    });

    it('keeps an unreviewed asset card visible without asking for a source type', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='en' messages={en} timeZone='UTC'>
                <AssetGrid
                    items={[
                        {
                            asset: {
                                key: 'photo',
                                url: 'https://media.xcity.ai/photo.png',
                                kind: 'image',
                                bytes: 1024,
                                uploaded: null,
                                name: 'Photo'
                            },
                            reviewState: 'missing',
                            source: 'cloud'
                        }
                    ]}
                    onDelete={async () => {}}
                    onReview={async () => 'asset://approved'}
                    onSaveCharacter={() => {}}
                    onUseImage={() => {}}
                    onUseVideo={() => {}}
                    checkingAssetId={null}
                    onCheckReviewStatus={async () => {}}
                />
            </NextIntlClientProvider>
        );
        expect(html).toContain('Photo');
        expect(html).toContain('Needs review');
        expect(html).not.toContain('Choose material source');
    });

    it('keeps the image visible while marking an existing provider review as in progress', () => {
        const imageUrl = 'https://media.xcity.ai/media/u/user/refs/photo.png';
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='en' messages={en} timeZone='UTC'>
                <ReferenceImagesInput
                    urls={[imageUrl]}
                    onChange={() => {}}
                    maxImages={9}
                    declarations={{}}
                    approvedAuthorizationIds={new Set()}
                    portraits={[
                        {
                            assetId: 'pending-id',
                            groupId: 'review-group',
                            groupType: 'AIGC',
                            name: 'Photo',
                            thumbUrl: imageUrl,
                            status: 'Processing',
                            updatedAt: 1
                        }
                    ]}
                    onReviewReferenceAsset={async () => 'asset://pending-id'}
                    showCharacters={false}
                />
            </NextIntlClientProvider>
        );
        expect(html).toContain('src="' + imageUrl + '"');
        expect(html).toContain('title="Under review"');
    });
});
