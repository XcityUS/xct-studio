import styles from './index.module.scss';
import { ExternalLink, Library } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MODELARK_PLAYGROUND_GUIDE = 'https://docs.byteplus.com/en/docs/modelark/2105966';
const BYTEPLUS_ASSET_TERMS = 'https://docs.byteplus.com/en/docs/ModelArk/2275639';

export function OfficialAssetLibrary() {
    const t = useTranslations();
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
