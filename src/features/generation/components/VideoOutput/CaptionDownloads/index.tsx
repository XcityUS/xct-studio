'use client';

import { captionedFilename, createCaptionedVideo, downloadBlob } from './download';
import { Button } from '@/components/ui/Button';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type CaptionDownloadsProps = {
    jobId: string;
    videoSrc: string;
    subtitleSrt: string;
    filename?: string;
};

export function CaptionDownloads({ jobId, videoSrc, subtitleSrt, filename }: CaptionDownloadsProps) {
    const t = useTranslations();
    const [progress, setProgress] = React.useState<number | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const subtitleDownloadUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(subtitleSrt)}`;

    const handleCaptionedVideoDownload = async () => {
        setError(null);
        setProgress(0);
        try {
            const output = await createCaptionedVideo(videoSrc, subtitleSrt, setProgress);
            downloadBlob(output, captionedFilename(filename, jobId));
        } catch (caught) {
            console.error('Could not create captioned video download.', caught);
            setError(caught instanceof Error ? caught.message : t('Unknown error'));
        } finally {
            setProgress(null);
        }
    };

    const isBurning = progress !== null;
    const progressPercent = Math.round((progress ?? 0) * 100);

    return (
        <>
            <Button
                asChild
                variant='outline'
                className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                <a href={subtitleDownloadUrl} download={`${jobId}.srt`}>
                    <Download className='mr-2 h-4 w-4' />
                    {t('Subtitles')}
                </a>
            </Button>
            <Button
                type='button'
                onClick={() => void handleCaptionedVideoDownload()}
                disabled={isBurning}
                title={error ?? t('Burn the current subtitle track into the current video and download it')}
                variant='outline'
                className='min-w-0 flex-1 basis-36 border-white/20 bg-black whitespace-nowrap text-white hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60'>
                {isBurning ? (
                    <Loader2 className='mr-1.5 h-4 w-4 shrink-0 animate-spin' />
                ) : (
                    <Download className='mr-2 h-4 w-4 shrink-0' />
                )}
                {isBurning
                    ? t('Burning <lcur>progress<rcur><pct>', { progress: progressPercent })
                    : error
                      ? t('Retry captioned')
                      : t('Captioned')}
            </Button>
        </>
    );
}
