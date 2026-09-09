import styles from './index.module.scss';
import { CopyUrlButton } from '../CopyUrlButton';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import { ExternalLink, Library } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MODELARK_PLAYGROUND_GUIDE = 'https://docs.byteplus.com/en/docs/modelark/2105966';
const BYTEPLUS_ASSET_TERMS = 'https://docs.byteplus.com/en/docs/ModelArk/2275639';

type OfficialAssetLibraryProps = {
    declarations: Record<string, ReferenceDeclaration>;
};

type OfficialAsset = ReferenceDeclaration & {
    key: string;
};

function SavedOfficialAssets({ assets }: { assets: OfficialAsset[] }) {
    const t = useTranslations();
    if (assets.length === 0) return <p className={styles.empty}>{t('No saved official assets yet')}</p>;

    return (
        <div className={styles.savedAssets}>
            <h5>{t('Saved official assets')}</h5>
            <div className={styles.assetList}>
                {assets.map((asset) => {
                    const assetUrl = `asset://${asset.assetId}`;
                    return (
                        <article key={asset.key} className={styles.assetCard}>
                            <div>
                                <strong>{asset.assetId}</strong>
                                <span>{t('Seedance official reference asset')}</span>
                                {asset.note && <p>{asset.note}</p>}
                            </div>
                            <CopyUrlButton url={assetUrl} className={styles.copyButton} />
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

export function OfficialAssetLibrary({ declarations }: OfficialAssetLibraryProps) {
    const t = useTranslations();
    const officialAssets = Object.entries(declarations)
        .map(([key, declaration]) => ({ key, ...declaration }))
        .filter((declaration) => declaration.origin === 'official-asset' && declaration.assetId)
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
                <SavedOfficialAssets assets={officialAssets} />
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
