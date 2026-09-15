import { createSharedSubtitle, shareAspectRatio } from './media';
import styles from './page.module.scss';
import { VideoPlayer } from '@/components/ui/VideoPlayer';
import { studioPath, studioVideoSharePath } from '@/features/studio/routing';
import type { AppLocale } from '@/i18n/routing';
import { getRuntimeConfig } from '@/server/config/runtime-config';
import { Download, ExternalLink, RotateCcw } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type SharePageProps = {
    params: Promise<{ locale: AppLocale; id: string }>;
};

type ShareRecord = {
    id: string;
    title?: string;
    prompt: string;
    video_url: string;
    params: Record<string, unknown>;
    created_at?: string;
};

function safeShareId(id: string) {
    return /^[0-9a-z]{8}$/.test(id) ? id : '';
}

function setting(params: Record<string, unknown>, key: string) {
    const value = params[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}

async function loadShareRecord(id: string): Promise<ShareRecord | null> {
    const safeId = safeShareId(id);
    const workerUrl = getRuntimeConfig().mediaWorkerUrl;
    if (!safeId || !workerUrl) return null;

    const response = await fetch(`${workerUrl}/share/${encodeURIComponent(safeId)}.json`, { cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not load shared video (${response.status}).`);

    const data = (await response.json()) as Partial<ShareRecord>;
    if (
        data.id !== safeId ||
        typeof data.prompt !== 'string' ||
        typeof data.video_url !== 'string' ||
        !data.params ||
        typeof data.params !== 'object' ||
        Array.isArray(data.params)
    ) {
        return null;
    }

    return {
        id: safeId,
        prompt: data.prompt,
        video_url: data.video_url,
        params: data.params as Record<string, unknown>,
        ...(typeof data.title === 'string' && data.title ? { title: data.title } : {}),
        ...(typeof data.created_at === 'string' && data.created_at ? { created_at: data.created_at } : {})
    };
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
    const { id, locale } = await params;
    const t = await getTranslations({ locale });
    const record = await loadShareRecord(id);
    if (!record) return { title: t('Shared video') };
    const title = record.title || t('Shared video');
    const url = studioVideoSharePath(locale, record.id);

    return {
        title: `${title} | ${t('Xcity Video Studio')}`,
        description: record.prompt.slice(0, 160),
        openGraph: {
            title,
            description: record.prompt.slice(0, 160),
            url,
            type: 'video.other',
            videos: [{ url: record.video_url, type: 'video/mp4' }]
        }
    };
}

export default async function SharePage({ params }: SharePageProps) {
    const { id, locale } = await params;
    const t = await getTranslations({ locale });
    const record = await loadShareRecord(id);
    if (!record) notFound();

    const title = record.title || t('Shared video');
    const recreateUrl = `${studioPath(locale, 'video')}?share=${encodeURIComponent(record.id)}`;
    const subtitle = createSharedSubtitle(record);
    const aspectRatio = shareAspectRatio(setting(record.params, 'ratio'));
    const settings = [
        [t('Model'), setting(record.params, 'model')],
        [t('Aspect Ratio'), setting(record.params, 'ratio')],
        [t('Resolution'), setting(record.params, 'resolution')],
        [t('Duration'), setting(record.params, 'seconds')]
    ].filter(([, value]) => value);

    return (
        <main className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.copy}>
                    <p className={styles.eyebrow}>{t('Shared video')}</p>
                    <details className={styles.titleDisclosure}>
                        <summary aria-label={title}>
                            <h1>{title}</h1>
                        </summary>
                    </details>
                    {record.created_at && (
                        <p className={styles.meta}>{t('Shared on <lcur>date<rcur>', { date: record.created_at })}</p>
                    )}
                </div>
            </section>

            <section className={styles.viewer} aria-label={title}>
                <VideoPlayer
                    src={record.video_url}
                    instanceKey={`share:${record.id}:${subtitle ? 'subtitles-v2' : 'plain'}`}
                    aspectRatio={aspectRatio}
                    className={styles.player}
                    title={title}
                    preload='metadata'
                    subtitle={subtitle}
                />
            </section>

            <section className={styles.details}>
                <div className={styles.promptPanel}>
                    <h2>{t('Prompt')}</h2>
                    <p>{record.prompt}</p>
                </div>
                {settings.length > 0 && (
                    <div className={styles.settingsPanel}>
                        <h2>{t('Generation settings')}</h2>
                        <dl>
                            {settings.map(([label, value]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}
            </section>

            <div className={styles.footerActions}>
                <a className={styles.primaryAction} href={recreateUrl}>
                    <RotateCcw size={15} aria-hidden='true' />
                    {t('Recreate in Xcity Studio')}
                </a>
                <a className={styles.secondaryAction} href={record.video_url} target='_blank' rel='noreferrer'>
                    <ExternalLink size={15} aria-hidden='true' />
                    {t('Open video file')}
                </a>
                {subtitle && (
                    <a className={styles.secondaryAction} href={subtitle.url} download={`${record.id}.srt`}>
                        <Download size={15} aria-hidden='true' />
                        {t('Download subtitles')}
                    </a>
                )}
            </div>
        </main>
    );
}
