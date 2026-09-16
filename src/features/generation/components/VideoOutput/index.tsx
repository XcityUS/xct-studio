'use client';

import { CaptionDownloads } from './CaptionDownloads';
import { CaptionSyncButton } from './CaptionSyncButton';
import { ClickablePrompt } from './ClickablePrompt';
import { CompletedVideoPlayer } from './CompletedVideoPlayer';
import { Metadata } from './Metadata';
import { StatusBadge } from './StatusBadge';
import { useDisplayProgress } from './hooks';
import styles from './index.module.scss';
import { useOutputMessages } from './messages';
import type { VideoOutputProps } from './types';
import { captionTrackForOutput } from './utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { captionCuesToSrt } from '@/features/post-production/captions/alignment';
import { XCITY_BILLING_URL, shouldShowBillingAction } from '@/features/settings/billing';
import { sanitizeStudioErrorMessage } from '@/shared/errors';
import { cn } from '@/shared/utils/classnames';
import {
    AlertCircle,
    CreditCard,
    Download,
    Loader2,
    Rocket,
    RotateCcw,
    Share2,
    Sparkles,
    StepForward
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export function VideoOutput({
    job,
    videoSrc,
    thumbnailSrc,
    mediaExpired = false,
    isLoading,
    onSendToRemix,
    onDownload,
    onExtend,
    isExtendPending = false,
    onFinalize,
    finalizeDisabledReason,
    onShare,
    shareItem,
    isSharePending,
    onSyncCaptions,
    isCaptionSyncPending = false,
    previewUnavailable = false,
    isPreviewResolving = false,
    onRetryPreview,
    error
}: VideoOutputProps) {
    const t = useTranslations();
    const messages = useOutputMessages();
    const displayProgress = useDisplayProgress(job);
    const captionTrack = captionTrackForOutput(shareItem);
    const subtitleSrt = captionTrack?.status === 'completed' ? captionCuesToSrt(captionTrack.cues) : '';

    const handleDownload = () => {
        if (job && onDownload) {
            onDownload(job.id);
        }
    };

    const handleSendToRemix = () => {
        if (job && onSendToRemix) {
            onSendToRemix(job.id);
        }
    };

    const handleExtend = () => {
        if (job && onExtend) {
            onExtend(job.id);
        }
    };

    const handleFinalize = () => {
        if (job && onFinalize && !finalizeDisabledReason) {
            onFinalize(job.id);
        }
    };

    const handleShare = () => {
        if (shareItem && onShare) {
            onShare(shareItem);
        }
    };

    const completedOutput =
        job?.status === 'completed' && !mediaExpired && typeof videoSrc === 'string' ? { job, videoSrc } : null;
    const actionMessage = error ? sanitizeStudioErrorMessage(error) : null;
    const jobMessage = job?.error?.message ? sanitizeStudioErrorMessage(job.error.message) : null;
    const displayError = messages.error(actionMessage);
    const displayJobError = messages.error(jobMessage);
    const isActionBudgetError = shouldShowBillingAction(actionMessage);
    const isJobBudgetError = shouldShowBillingAction(jobMessage);
    const finalizeHint =
        messages.error(finalizeDisabledReason ?? null) ?? t('Review settings and generate a paid final version');

    // Rendered next to the buttons that raise it — an alert at the top of the
    // panel meant scrolling back up to find out why a click did nothing.
    const actionError = displayError ? (
        <div
            role='alert'
            className='shrink-0 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <span className='min-w-0 break-words'>{displayError}</span>
                {isActionBudgetError && (
                    <Button asChild size='sm' className='w-full bg-white text-black hover:bg-white/90 sm:w-auto'>
                        <a href={XCITY_BILLING_URL}>
                            <CreditCard className='h-4 w-4' />
                            {t('Billing')}
                        </a>
                    </Button>
                )}
            </div>
        </div>
    ) : null;
    const isCompletedWithVideo = Boolean(completedOutput);
    const isCompletedExpired = job?.status === 'completed' && mediaExpired;
    const showCompletedDetails = isCompletedWithVideo || isCompletedExpired;

    return (
        <Card className='flex h-full w-full flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='shrink-0 border-b border-white/10 pb-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <CardTitle className='text-lg font-medium text-white'>{t('Video Output')}</CardTitle>
                        <CardDescription className='mt-1 text-white/60'>
                            {t('Your generated video will appear here')}
                        </CardDescription>
                    </div>
                    {job && <StatusBadge status={job.status} progress={displayProgress} />}
                </div>
            </CardHeader>
            <CardContent
                className={cn(
                    'flex min-h-0 flex-1 flex-col overflow-y-auto p-4',
                    showCompletedDetails ? 'items-stretch justify-start gap-4' : 'items-center justify-center'
                )}>
                {!job && !isLoading && (
                    <div className='flex flex-col items-center justify-center text-center'>
                        <Sparkles className='mb-4 h-12 w-12 text-white/20' />
                        <p className='text-white/40'>{t('No video job started yet')}</p>
                        <p className='mt-2 text-sm text-white/30'>{t('Submit a prompt to create your first video')}</p>
                    </div>
                )}

                {isLoading && !job && (
                    <div className='flex flex-col items-center justify-center text-center'>
                        <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                        <p className='text-white/60'>{t('Initializing video generation')}</p>
                    </div>
                )}

                {job && (job.status === 'queued' || job.status === 'in_progress') && (
                    <div className='w-full space-y-4'>
                        <div className='flex flex-col items-center justify-center text-center'>
                            <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                            <p className='text-lg text-white/80'>
                                {job.id.startsWith('temp_')
                                    ? t('Sending request to Xcity TokenHub')
                                    : job.status === 'queued'
                                      ? t('Your video is queued')
                                      : t('Generating your video')}
                            </p>
                            <p className='mt-2 text-sm text-white/40'>
                                {job.id.startsWith('temp_')
                                    ? t('Initializing video generation job')
                                    : t('This may take several minutes depending on video length and API load')}
                            </p>
                        </div>

                        {job.status === 'in_progress' && !job.id.startsWith('temp_') && (
                            <div className='w-full space-y-2'>
                                <div className='flex justify-between text-sm text-white/60'>
                                    <span>{t('Progress')}</span>
                                    <span>{displayProgress}%</span>
                                </div>
                                <div className='h-2 w-full overflow-hidden rounded-full bg-white/10'>
                                    <div
                                        className='h-full rounded-full bg-blue-500 transition-all duration-1000 ease-linear'
                                        style={{ width: `${displayProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {job.prompt && !job.id.startsWith('temp_') && (
                            <ClickablePrompt
                                prompt={job.prompt}
                                sourcePrompt={shareItem?.createParams?.caption_source_prompt}
                            />
                        )}

                        {!job.id.startsWith('temp_') && <Metadata job={job} />}
                    </div>
                )}

                {isCompletedExpired && job && (
                    <div className='w-full space-y-4'>
                        <div className='rounded-md border border-amber-500/25 bg-amber-500/10 p-4'>
                            <div className='flex items-center gap-2 text-amber-200'>
                                <AlertCircle className='h-5 w-5' />
                                <p className='text-base font-medium'>{t('Media no longer available')}</p>
                            </div>
                            <p className='mt-2 text-sm text-amber-100/75'>
                                {t(
                                    'The provider link expired 24 h after generation<comma> and this clip was never archived'
                                )}
                            </p>
                        </div>

                        {job.prompt && (
                            <ClickablePrompt
                                prompt={job.prompt}
                                sourcePrompt={shareItem?.createParams?.caption_source_prompt}
                            />
                        )}

                        <Metadata job={job} />

                        {onFinalize && (
                            <Button
                                onClick={handleFinalize}
                                disabled={Boolean(finalizeDisabledReason)}
                                title={finalizeHint}
                                variant='outline'
                                className='border-white/20 bg-black text-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                <Rocket className='mr-2 h-4 w-4' />
                                {t('Finalize')}
                            </Button>
                        )}
                    </div>
                )}

                {job && job.status === 'completed' && !completedOutput && !mediaExpired && (
                    <div className='flex flex-col items-center justify-center text-center'>
                        {thumbnailSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={thumbnailSrc}
                                alt={t('Video first frame')}
                                className='mb-4 max-h-64 rounded-lg border border-white/10 object-contain'
                            />
                        ) : previewUnavailable ? (
                            <AlertCircle className='mb-4 h-12 w-12 text-amber-300/80' />
                        ) : (
                            <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                        )}
                        {previewUnavailable ? (
                            <>
                                <p className='text-white/60'>{t('Preview unavailable')}</p>
                                <p className='mt-2 max-w-md text-sm text-white/40'>
                                    {t(
                                        'The gateway has not published a playable link for this clip<dot> It may still be post<dash>processing<comma> or its link may have expired before the cloud copy was made'
                                    )}
                                </p>
                                {onRetryPreview && (
                                    <Button
                                        onClick={onRetryPreview}
                                        variant='outline'
                                        className='mt-4 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                        <RotateCcw className='mr-2 h-4 w-4' />
                                        {t('Retry')}
                                    </Button>
                                )}
                            </>
                        ) : isPreviewResolving ? (
                            <>
                                <p className='text-white/60'>
                                    {t('Render complete <mdash> waiting for playback link<hellip>')}
                                </p>
                                <p className='mt-2 max-w-md text-sm text-white/40'>
                                    {t(
                                        'The provider has marked the job complete<comma> but the downloadable video URL has not been published yet'
                                    )}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className='text-white/60'>{t('Preview source missing')}</p>
                                <p className='mt-2 max-w-md text-sm text-white/40'>
                                    {t(
                                        'This job is complete<comma> but this browser does not currently have a local copy<comma> R2 URL<comma> or provider playback URL for it'
                                    )}
                                </p>
                                {onRetryPreview && (
                                    <Button
                                        onClick={onRetryPreview}
                                        variant='outline'
                                        className='mt-4 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                        <RotateCcw className='mr-2 h-4 w-4' />
                                        {t('Retry')}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {completedOutput && (
                    <div className='flex h-full min-h-0 w-full flex-col gap-4'>
                        <CompletedVideoPlayer
                            key={completedOutput.job.id}
                            jobId={completedOutput.job.id}
                            videoSrc={completedOutput.videoSrc}
                            size={completedOutput.job.size}
                            thumbnailSrc={thumbnailSrc}
                            captionTrack={captionTrack}
                            onSourceError={onRetryPreview}
                        />

                        {captionTrack && (
                            <p
                                role='status'
                                className={cn(
                                    'rounded-md border px-3 py-2 text-sm',
                                    captionTrack.status === 'completed'
                                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
                                        : 'border-amber-500/25 bg-amber-500/10 text-amber-100'
                                )}>
                                {captionTrack.status === 'completed'
                                    ? captionTrack.delivery === 'player'
                                        ? t('Subtitles ready <lcur>count<rcur>', {
                                              count: captionTrack.expectedDialogueCount
                                          })
                                        : t('Subtitles ready <lcur>matched<rcur><slash><lcur>expected<rcur>', {
                                              matched: captionTrack.matchedDialogueCount,
                                              expected: captionTrack.expectedDialogueCount
                                          })
                                    : t('Subtitle generation failed<colon> <lcur>reason<rcur>', {
                                          reason: captionTrack.warning ?? t('Unknown error')
                                      })}
                            </p>
                        )}

                        <div className={styles.completedActions}>
                            {onDownload && (
                                <Button
                                    onClick={handleDownload}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                    <Download className='mr-2 h-4 w-4' />
                                    {t('Download')}
                                </Button>
                            )}
                            {subtitleSrt && job && (
                                <CaptionDownloads
                                    jobId={job.id}
                                    videoSrc={completedOutput.videoSrc}
                                    subtitleSrt={subtitleSrt}
                                    filename={shareItem?.filename}
                                />
                            )}
                            {captionTrack?.source === 'script-timed' &&
                                captionTrack.delivery === 'player' &&
                                onSyncCaptions && (
                                    <CaptionSyncButton
                                        pending={isCaptionSyncPending}
                                        onClick={() => job && onSyncCaptions(job.id)}
                                    />
                                )}
                            {onExtend && (
                                <Button
                                    onClick={handleExtend}
                                    disabled={isExtendPending}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60'>
                                    {isExtendPending ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <StepForward className='mr-2 h-4 w-4' />
                                    )}
                                    {isExtendPending ? t('Preparing') : t('Extend')}
                                </Button>
                            )}
                            {onFinalize && (
                                <Button
                                    onClick={handleFinalize}
                                    disabled={Boolean(finalizeDisabledReason)}
                                    title={finalizeHint}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                    <Rocket className='mr-2 h-4 w-4' />
                                    {t('Finalize')}
                                </Button>
                            )}
                            {onShare && shareItem && (
                                <Button
                                    onClick={handleShare}
                                    disabled={!shareItem.storedUrl || isSharePending}
                                    title={
                                        shareItem.storedUrl
                                            ? t('Share this video')
                                            : t('Archive to cloud first <mdash> wait a moment')
                                    }
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                    {isSharePending ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <Share2 className='mr-2 h-4 w-4' />
                                    )}
                                    {t('Share')}
                                </Button>
                            )}
                            {onSendToRemix && (
                                <Button
                                    onClick={handleSendToRemix}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                    <Sparkles className='mr-2 h-4 w-4' />
                                    {t('Send to Remix')}
                                </Button>
                            )}
                        </div>

                        {actionError}

                        {completedOutput.job.prompt && (
                            <ClickablePrompt
                                prompt={completedOutput.job.prompt}
                                sourcePrompt={shareItem?.createParams?.caption_source_prompt}
                            />
                        )}

                        <Metadata job={completedOutput.job} />
                    </div>
                )}

                {job && job.status === 'failed' && (
                    <div className='w-full space-y-4'>
                        <div className='flex flex-col items-center justify-center text-center'>
                            <AlertCircle className='mb-4 h-12 w-12 text-red-400' />
                            <p className='text-lg text-red-300'>{t('Video generation failed')}</p>
                            {displayJobError && (
                                <div className='mt-4 max-w-md rounded-md border border-red-500/30 bg-red-500/10 p-4'>
                                    <p className='text-sm font-medium text-red-200'>{t('Error<colon>')}</p>
                                    <p className='mt-1 text-sm text-red-300'>{displayJobError}</p>
                                    {isJobBudgetError && (
                                        <Button
                                            asChild
                                            size='sm'
                                            className='mt-3 w-full bg-white text-black hover:bg-white/90 sm:w-auto'>
                                            <a href={XCITY_BILLING_URL}>
                                                <CreditCard className='h-4 w-4' />
                                                {t('Billing')}
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className='rounded-md border border-red-500/20 bg-red-500/10 p-4'>
                            <p className='text-sm text-red-300'>
                                {t('The video generation encountered an error<dot> This could be due to<colon>')}
                            </p>
                            <ul className='mt-2 list-inside list-disc space-y-1 text-xs text-red-300/80'>
                                <li>{t('Content policy violations')}</li>
                                <li>{t('Invalid input parameters')}</li>
                                <li>{t('API service issues')}</li>
                            </ul>
                        </div>

                        {job.prompt && (
                            <ClickablePrompt
                                prompt={job.prompt}
                                sourcePrompt={shareItem?.createParams?.caption_source_prompt}
                            />
                        )}

                        <Metadata job={job} />
                    </div>
                )}

                {!completedOutput && actionError && <div className='w-full'>{actionError}</div>}
            </CardContent>
        </Card>
    );
}
