import styles from './index.module.scss';
import { CopyUrlButton } from '../CopyUrlButton';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { ReferenceUseOptions } from '@/features/assets/components/AssetsPanel/types';
import { ExternalLink, ImagePlus, Library } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MODELARK_PLAYGROUND_GUIDE = 'https://docs.byteplus.com/en/docs/modelark/2105966';
const BYTEPLUS_ASSET_TERMS = 'https://docs.byteplus.com/en/docs/ModelArk/2275639';

type OfficialAssetLibraryProps = {
    declarations: Record<string, ReferenceDeclaration>;
    referenceImageUrls: string[];
    onUseImage: (sourceUrl: string, providerReferenceUrl?: string, options?: ReferenceUseOptions) => void;
};

type OfficialAsset = ReferenceDeclaration & {
    key: string;
};

type SavedOfficialAsset = OfficialAsset & {
    assetId: string;
};

function isSavedOfficialAsset(asset: OfficialAsset): asset is SavedOfficialAsset {
    return asset.origin === 'official-asset' && Boolean(asset.assetId);
}

function SavedOfficialAssets({
    assets,
    referenceImageUrls,
    onUseImage
}: {
    assets: SavedOfficialAsset[];
    referenceImageUrls: string[];
    onUseImage: (sourceUrl: string, providerReferenceUrl?: string, options?: ReferenceUseOptions) => void;
}) {
    const t = useTranslations();
    if (assets.length === 0) return <p className={styles.empty}>{t('No saved official assets yet')}</p>;

    return (
        <div className={styles.savedAssets}>
            <h5>{t('Saved official assets')}</h5>
            <div className={styles.assetList}>
                {assets.map((asset) => {
                    const assetUrl = `asset://${asset.assetId}`;
                    const isAttached = referenceImageUrls.includes(assetUrl);
                    return (
                        <article key={asset.key} className={styles.assetCard}>
                            <div>
                                <strong>{asset.assetId}</strong>
                                <span>{t('Seedance official reference asset')}</span>
                                <p>{asset.note || t('No description yet')}</p>
                            </div>
                            <div className={styles.cardActions}>
                                <CopyUrlButton url={assetUrl} className={styles.copyButton} />
                                <button
                                    type='button'
                                    className={styles.referenceButton}
                                    disabled={isAttached}
                                    onClick={() => onUseImage(assetUrl, assetUrl, { stayOnAssets: true })}>
                                    <ImagePlus aria-hidden='true' />
                                    {isAttached ? t('Already referenced') : t('Add reference')}
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

export function OfficialAssetLibrary({ declarations, referenceImageUrls, onUseImage }: OfficialAssetLibraryProps) {
    const t = useTranslations();
    const officialAssets = Object.entries(declarations)
        .map(([key, declaration]) => ({ key, ...declaration }))
        .filter(isSavedOfficialAsset)
        .sort((left, right) => right.declaredAt - left.declaredAt);

    return (
        <div className={styles.root}>
            <Library aria-hidden='true' />
            <div className={styles.content}>
                <h4>{t('Seedance official asset library')}</h4>
                <p>
                    {t(
                        'Choose an official reference asset in ModelArk Playground<comma> then paste its Asset ID above<dot> Xcity does not copy the provider catalog'
                    )}
                </p>
                <p className={styles.notice}>
                    {t('Official reference assets are limited to the usage permitted by BytePlus')}
                </p>
                <SavedOfficialAssets
                    assets={officialAssets}
                    referenceImageUrls={referenceImageUrls}
                    onUseImage={onUseImage}
                />
                <div className={styles.actions}>
                    <a href={MODELARK_PLAYGROUND_GUIDE} target='_blank' rel='noreferrer'>
                        {t('Open ModelArk Playground guide')}
                        <ExternalLink aria-hidden='true' />
                    </a>
                    <a href={BYTEPLUS_ASSET_TERMS} target='_blank' rel='noreferrer'>
                        {t('View asset usage terms')}
                        <ExternalLink aria-hidden='true' />
                    </a>
                </div>
            </div>
        </div>
    );
}
