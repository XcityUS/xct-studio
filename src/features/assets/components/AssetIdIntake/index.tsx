'use client';

import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import { normalizeAssetId, type ReferenceOrigin } from '@/features/assets/reference/origin';
import { ExternalLink, Link2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const SOURCE_OPTIONS: ReferenceOrigin[] = [
    'no-person',
    'official-asset',
    'thirdparty-ai',
    'real-person',
    'public-figure',
    'licensed-ip'
];

type AssetIdIntakeProps = {
    onAttachAssetId: (input: { assetId: string; origin: ReferenceOrigin; note?: string }) => boolean;
};

function useAssetIdIntakeForm(onAttachAssetId: AssetIdIntakeProps['onAttachAssetId']) {
    const t = useTranslations();
    const [assetId, setAssetId] = React.useState('');
    const [origin, setOrigin] = React.useState<ReferenceOrigin>('no-person');
    const [note, setNote] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const sourceLabels: Record<ReferenceOrigin, string> = {
        'no-person': t('Reviewed material without a person or protected IP'),
        'official-asset': t('Seedance official reference asset'),
        'byteplus-ai': t('Seedream output'),
        'thirdparty-ai': t('External AI material'),
        'real-person': t('Verified ordinary person'),
        'public-figure': t('Authorized public figure'),
        'licensed-ip': t('Authorized protected IP')
    };
    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const normalized = normalizeAssetId(assetId);
        if (!normalized) {
            setNotice(t('Asset ID is required'));
            return;
        }
        if (!onAttachAssetId({ assetId: normalized, origin, note: note.trim() || undefined })) return;

        setAssetId('');
        setNote('');
        setNotice(t('Asset ID attached to the video form'));
    };

    return { assetId, handleSubmit, note, notice, origin, setAssetId, setNote, setOrigin, sourceLabels };
}

type AssetIdFormProps = ReturnType<typeof useAssetIdIntakeForm>;

function AssetIdForm({
    assetId,
    handleSubmit,
    note,
    origin,
    setAssetId,
    setNote,
    setOrigin,
    sourceLabels
}: AssetIdFormProps) {
    const t = useTranslations();
    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
                <span>{t('Material source')}</span>
                <Dropdown
                    value={origin}
                    onValueChange={(value) => setOrigin(value as ReferenceOrigin)}
                    options={SOURCE_OPTIONS.map((value) => ({ value, label: sourceLabels[value] }))}
                />
            </label>
            <label className={styles.field}>
                <span>{t('Asset ID')}</span>
                <input
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                    placeholder={t('Paste an Asset ID or asset<colon><slash><slash> reference')}
                    autoComplete='off'
                />
            </label>
            <label className={styles.field}>
                <span>{t('Asset note <lpar>optional<rpar>')}</span>
                <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t('Describe this official asset')}
                    autoComplete='off'
                />
            </label>
            <button className={styles.submit} type='submit'>
                <Link2 size={16} aria-hidden='true' />
                {t('Attach Asset ID')}
            </button>
        </form>
    );
}

export function AssetIdIntake({ onAttachAssetId }: AssetIdIntakeProps) {
    const t = useTranslations();
    const form = useAssetIdIntakeForm(onAttachAssetId);

    return (
        <section className={styles.root} aria-labelledby='asset-id-intake-title'>
            <div className={styles.heading}>
                <span className={styles.icon} aria-hidden='true'>
                    <ShieldCheck size={18} />
                </span>
                <div>
                    <h3 id='asset-id-intake-title'>{t('Asset approval and ID')}</h3>
                    <p>
                        {t(
                            'Seedream output can be used directly<dot> Every other material must be reviewed and bound to an Asset ID'
                        )}
                    </p>
                </div>
            </div>

            <AssetIdForm {...form} />

            <div className={styles.meta}>
                <p>{form.notice || t('Private asset APIs require KYC High access')}</p>
                <a href='https://docs.byteplus.com/en/docs/ModelArk/2333565' target='_blank' rel='noreferrer'>
                    {t('Open ModelArk asset guide')}
                    <ExternalLink size={13} aria-hidden='true' />
                </a>
            </div>
        </section>
    );
}
