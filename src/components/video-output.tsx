'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { estimateVideoProgress } from '@/lib/progress';
import type { VideoJob, VideoMetadata } from '@/types/video';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Copy,
    Check,
    Download,
    Loader2,
    Pause,
    Play,
    Rocket,
    RotateCcw,
    Share2,
    Sparkles,
    StepForward
} from 'lucide-react';
import * as React from 'react';

type VideoOutputProps = {
    job: VideoJob | null;
    videoSrc: string | null | undefined;
    thumbnailSrc?: string | null | undefined;
    mediaExpired?: boolean;
    isLoading: boolean;
    onSendToRemix?: (videoId: string) => void;
    onDownload?: (videoId: string) => void;
    onExtend?: (videoId: string) => void;
    onFinalize?: (videoId: string) => void;
    onShare?: (item: VideoMetadata) => void;
    shareItem?: VideoMetadata;
    isSharePending?: boolean;
    /** The gateway has no playable link for this completed job (yet). */
    previewUnavailable?: boolean;
    /** A completed job is still being probed for a playable source. */
    isPreviewResolving?: boolean;
    /** Re-resolves a playback source for the current job. */
    onRetryPreview?: () => void;
    /** Message for an action taken from this panel — rendered under the buttons. */
    error?: string | null;
};

function ClickablePrompt({ prompt }: { prompt: string }) {
    const [copied, setCopied] = React.useState(false);

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy prompt:', err);
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className='group cursor-pointer rounded-md bg-white/5 p-3 hover:bg-white/10 transition-colors'
                    onClick={handleCopyPrompt}
                >
                    <div className='flex items-start justify-between gap-2'>
                        <p className='text-xs text-white/70 line-clamp-2 flex-1'>
                            {prompt}
                        </p>
                        <div className='shrink-0 text-white/40 group-hover:text-white/60 transition-colors'>
                            {copied ? (
                                <Check className='h-3.5 w-3.5 text-green-400' />
                            ) : (
                                <Copy className='h-3.5 w-3.5' />
                            )}
                        </div>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-black border border-white/20 text-white">
                <p>Click to copy full prompt</p>
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * Smoothly ticking display progress for a running job. The gateway rarely
 * reports a real percentage mid-flight, so this re-renders once a second and
 * blends the reported value with a time-based estimate.
 */
function useDisplayProgress(job: VideoJob | null): number {
    const running = Boolean(job && (job.status === 'queued' || job.status === 'in_progress'));
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!running) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [running, job?.id]);

    if (!job) return 0;
    if (job.status === 'completed') return 100;
    if (!running) return job.progress || 0;
    return estimateVideoProgress(job.created_at, Number(job.seconds), job.progress, now);
}

export function VideoOutput({
    job,
    videoSrc,
    thumbnailSrc,
    mediaExpired = false,
    isLoading,
    onSendToRemix,
    onDownload,
    onExtend,
    onFinalize,
    onShare,
    shareItem,
    isSharePending,
    previewUnavailable = false,
    isPreviewResolving = false,
    onRetryPreview,
    error
}: VideoOutputProps) {
    const displayProgress = useDisplayProgress(job);

    const getStatusBadge = () => {
        if (!job) return null;

        switch (job.status) {
            case 'queued':
                return (
                    <div className='flex items-center gap-2 rounded-md bg-blue-500/20 px-3 py-1.5 text-sm text-blue-300'>
                        <Clock className='h-4 w-4' />
                        Queued
                    </div>
                );
            case 'in_progress':
                return (
                    <div className='flex items-center gap-2 rounded-md bg-yellow-500/20 px-3 py-1.5 text-sm text-yellow-300'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Processing {displayProgress}%
                    </div>
                );
            case 'completed':
                return (
                    <div className='flex items-center gap-2 rounded-md bg-green-500/20 px-3 py-1.5 text-sm text-green-300'>
                        <CheckCircle className='h-4 w-4' />
                        Completed
                    </div>
                );
            case 'failed':
                return (
                    <div className='flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-300'>
                        <AlertCircle className='h-4 w-4' />
                        Failed
                    </div>
                );
        }
    };

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
        if (job && onFinalize) {
            onFinalize(job.id);
        }
    };

    const handleShare = () => {
        if (shareItem && onShare) {
            onShare(shareItem);
        }
    };

    const completedOutput =
        job?.status === 'completed' && !mediaExpired && typeof videoSrc === 'string'
            ? { job, videoSrc }
            : null;

    // Rendered next to the buttons that raise it — an alert at the top of the
    // panel meant scrolling back up to find out why a click did nothing.
    const actionError = error ? (
        <div
            role='alert'
            className='shrink-0 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200'>
            {error}
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
                        <CardTitle className='text-lg font-medium text-white'>Video Output</CardTitle>
                        <CardDescription className='mt-1 text-white/60'>
                            Your generated video will appear here
                        </CardDescription>
                    </div>
                    {job && getStatusBadge()}
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
                        <p className='text-white/40'>No video job started yet</p>
                        <p className='mt-2 text-sm text-white/30'>
                            Submit a prompt to create your first video
                        </p>
                    </div>
                )}

                {isLoading && !job && (
                    <div className='flex flex-col items-center justify-center text-center'>
                        <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                        <p className='text-white/60'>Initializing video generation...</p>
                    </div>
                )}

                {job && (job.status === 'queued' || job.status === 'in_progress') && (
                    <div className='w-full space-y-4'>
                        <div className='flex flex-col items-center justify-center text-center'>
                            <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                            <p className='text-lg text-white/80'>
                                {job.id.startsWith('temp_')
                                    ? 'Sending request to Xcity TokenHub...'
                                    : job.status === 'queued'
                                        ? 'Your video is queued...'
                                        : 'Generating your video...'}
                            </p>
                            <p className='mt-2 text-sm text-white/40'>
                                {job.id.startsWith('temp_')
                                    ? 'Initializing video generation job'
                                    : 'This may take several minutes depending on video length and API load'}
                            </p>
                        </div>

                        {job.status === 'in_progress' && !job.id.startsWith('temp_') && (
                            <div className='w-full space-y-2'>
                                <div className='flex justify-between text-sm text-white/60'>
                                    <span>Progress</span>
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
                            <ClickablePrompt prompt={job.prompt} />
                        )}

                        {!job.id.startsWith('temp_') && (
                            <div className='mt-4 rounded-md bg-white/5 p-4'>
                                <p className='text-xs text-white/40'>
                                    <span className='font-medium text-white/60'>Model:</span> {job.model}
                                </p>
                                <p className='text-xs text-white/40'>
                                    <span className='font-medium text-white/60'>Resolution:</span> {job.size}
                                </p>
                                <p className='text-xs text-white/40'>
                                    <span className='font-medium text-white/60'>Duration:</span> {job.seconds}s
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {isCompletedExpired && job && (
                    <div className='w-full space-y-4'>
                        <div className='rounded-md border border-amber-500/25 bg-amber-500/10 p-4'>
                            <div className='flex items-center gap-2 text-amber-200'>
                                <AlertCircle className='h-5 w-5' />
                                <p className='text-base font-medium'>Media no longer available</p>
                            </div>
                            <p className='mt-2 text-sm text-amber-100/75'>
                                The provider link expired 24 h after generation, and this clip was never archived.
                            </p>
                        </div>

                        {job.prompt && <ClickablePrompt prompt={job.prompt} />}

                        <div className='shrink-0 rounded-md bg-white/5 p-4'>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Model:</span> {job.model}
                            </p>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Resolution:</span> {job.size}
                            </p>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Duration:</span> {job.seconds}s
                            </p>
                        </div>

                        {onFinalize && (
                            <Button
                                onClick={handleFinalize}
                                variant='outline'
                                className='border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                <Rocket className='mr-2 h-4 w-4' />
                                Finalize
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
                                alt='Video first frame'
                                className='mb-4 max-h-64 rounded-lg border border-white/10 object-contain'
                            />
                        ) : previewUnavailable ? (
                            <AlertCircle className='mb-4 h-12 w-12 text-amber-300/80' />
                        ) : (
                            <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                        )}
                        {previewUnavailable ? (
                            <>
                                <p className='text-white/60'>Preview unavailable</p>
                                <p className='mt-2 max-w-md text-sm text-white/40'>
                                    The gateway has not published a playable link for this clip. It may still be
                                    post-processing, or its link may have expired before the cloud copy was made.
                                </p>
                                {onRetryPreview && (
                                    <Button
                                        onClick={onRetryPreview}
                                        variant='outline'
                                        className='mt-4 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                        <RotateCcw className='mr-2 h-4 w-4' />
                                        Retry
                                    </Button>
                                )}
                            </>
                        ) : isPreviewResolving ? (
                            <>
                                <p className='text-white/60'>Render complete — waiting for playback link…</p>
                                <p className='mt-2 max-w-md text-sm text-white/40'>
                                    The provider has marked the job complete, but the downloadable video URL has not
                                    been published yet.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className='text-white/60'>Preview source missing</p>
                                <p className='mt-2 max-w-md text-sm text-white/40'>
                                    This job is complete, but this browser does not currently have a local copy, R2
                                    URL, or provider playback URL for it.
                                </p>
                                {onRetryPreview && (
                                    <Button
                                        onClick={onRetryPreview}
                                        variant='outline'
                                        className='mt-4 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                        <RotateCcw className='mr-2 h-4 w-4' />
                                        Retry
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {completedOutput && (
                    <div className='flex h-full min-h-0 w-full flex-col gap-4'>
                        <CompletedVideoPlayer
                            key={`${completedOutput.job.id}:${completedOutput.videoSrc}`}
                            jobId={completedOutput.job.id}
                            videoSrc={completedOutput.videoSrc}
                            thumbnailSrc={thumbnailSrc}
                            onSourceError={onRetryPreview}
                        />

                        <div className='flex shrink-0 flex-wrap gap-3'>
                            {onDownload && (
                                <Button
                                    onClick={handleDownload}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                    <Download className='mr-2 h-4 w-4' />
                                    Download
                                </Button>
                            )}
                            {onExtend && (
                                <Button
                                    onClick={handleExtend}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                    <StepForward className='mr-2 h-4 w-4' />
                                    Extend
                                </Button>
                            )}
                            {onFinalize && (
                                <Button
                                    onClick={handleFinalize}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                    <Rocket className='mr-2 h-4 w-4' />
                                    Finalize
                                </Button>
                            )}
                            {onShare && shareItem && (
                                <Button
                                    onClick={handleShare}
                                    disabled={!shareItem.storedUrl || isSharePending}
                                    title={
                                        shareItem.storedUrl
                                            ? 'Share this video'
                                            : 'Archive to cloud first — wait a moment'
                                    }
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                    {isSharePending ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <Share2 className='mr-2 h-4 w-4' />
                                    )}
                                    Share
                                </Button>
                            )}
                            {onSendToRemix && (
                                <Button
                                    onClick={handleSendToRemix}
                                    variant='outline'
                                    className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white'>
                                    <Sparkles className='mr-2 h-4 w-4' />
                                    Send to Remix
                                </Button>
                            )}
                        </div>

                        {actionError}

                        {completedOutput.job.prompt && (
                            <ClickablePrompt prompt={completedOutput.job.prompt} />
                        )}

                        <div className='shrink-0 rounded-md bg-white/5 p-4'>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Model:</span> {completedOutput.job.model}
                            </p>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Resolution:</span> {completedOutput.job.size}
                            </p>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Duration:</span> {completedOutput.job.seconds}s
                            </p>
                        </div>
                    </div>
                )}

                {job && job.status === 'failed' && (
                    <div className='w-full space-y-4'>
                        <div className='flex flex-col items-center justify-center text-center'>
                            <AlertCircle className='mb-4 h-12 w-12 text-red-400' />
                            <p className='text-lg text-red-300'>Video generation failed</p>
                            {job.error && (
                                <div className='mt-4 max-w-md rounded-md border border-red-500/30 bg-red-500/10 p-4'>
                                    <p className='text-sm font-medium text-red-200'>Error:</p>
                                    <p className='mt-1 text-sm text-red-300'>{job.error.message}</p>
                                </div>
                            )}
                        </div>

                        <div className='rounded-md border border-red-500/20 bg-red-500/10 p-4'>
                            <p className='text-sm text-red-300'>
                                The video generation encountered an error. This could be due to:
                            </p>
                            <ul className='mt-2 list-inside list-disc space-y-1 text-xs text-red-300/80'>
                                <li>Content policy violations</li>
                                <li>Invalid input parameters</li>
                                <li>API service issues</li>
                            </ul>
                        </div>

                        {job.prompt && (
                            <ClickablePrompt prompt={job.prompt} />
                        )}

                        <div className='rounded-md bg-white/5 p-4'>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Model:</span> {job.model}
                            </p>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Resolution:</span> {job.size}
                            </p>
                            <p className='text-xs text-white/40'>
                                <span className='font-medium text-white/60'>Duration:</span> {job.seconds}s
                            </p>
                        </div>
                    </div>
                )}

                {!completedOutput && actionError && <div className='w-full'>{actionError}</div>}
            </CardContent>
        </Card>
    );
}

type CompletedVideoPlayerProps = {
    jobId: string;
    videoSrc: string;
    thumbnailSrc?: string | null | undefined;
    onSourceError?: () => void;
};

function CompletedVideoPlayer({ jobId, videoSrc, thumbnailSrc, onSourceError }: CompletedVideoPlayerProps) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [hasInteracted, setHasInteracted] = React.useState(false);
    const [isHovering, setIsHovering] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);

    // Playhead mirrored into refs: any src change reloads the element and
    // wipes its state before an effect can read it.
    const positionRef = React.useRef(0);
    const playingRef = React.useRef(false);
    const loadedSrcRef = React.useRef<string | null>(null);
    const pendingResumeRef = React.useRef<{ time: number; playing: boolean } | null>(null);

    // New clip: start from scratch.
    React.useEffect(() => {
        const video = videoRef.current;
        setIsPlaying(false);
        setHasInteracted(false);
        setCurrentTime(0);
        setDuration(0);
        positionRef.current = 0;
        playingRef.current = false;
        loadedSrcRef.current = null;
        pendingResumeRef.current = null;

        if (video) {
            video.pause();
            try {
                video.currentTime = 0;
            } catch (error) {
                console.warn('Unable to reset video currentTime:', error);
            }
        }
    }, [jobId]);

    /**
     * The URL for a clip that is already on screen gets swapped underneath us
     * — the permanent R2 copy replacing the provider link, a downloaded blob
     * replacing both. That reloads the element, which used to dump the viewer
     * back to the start (and, with the old poster-dependent `#t=` fragment,
     * looked like the preview closing a second in). Carry the playhead over.
     */
    React.useEffect(() => {
        if (loadedSrcRef.current === null || loadedSrcRef.current === videoSrc) {
            loadedSrcRef.current = videoSrc;
            return;
        }
        loadedSrcRef.current = videoSrc;
        pendingResumeRef.current = { time: positionRef.current, playing: playingRef.current };
    }, [videoSrc]);

    const handleTogglePlayback = React.useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused || video.ended) {
            if (video.ended || (duration > 0 && video.currentTime >= duration - 0.05)) {
                video.currentTime = 0;
                setCurrentTime(0);
                positionRef.current = 0;
            }
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.warn('Video playback failed to start:', error);
                });
            }
        } else {
            video.pause();
        }
    }, [duration]);

    const handleSliderChange = React.useCallback(
        (value: number[]) => {
            if (value.length) {
                setCurrentTime(Math.min(value[0], duration));
            }
        },
        [duration]
    );

    const handleSliderCommit = React.useCallback(
        (value: number[]) => {
            const video = videoRef.current;
            if (!video || !value.length) return;

            const targetTime = Math.min(Math.max(value[0], 0), duration);
            video.currentTime = targetTime;
            setCurrentTime(targetTime);
            setHasInteracted(true);
        },
        [duration]
    );

    const formatTime = React.useCallback((timeInSeconds: number) => {
        if (!Number.isFinite(timeInSeconds) || timeInSeconds < 0) {
            return '0:00';
        }

        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    const showOverlay = !hasInteracted || isHovering || !isPlaying;
    const safeDuration = duration > 0 ? duration : 0.01;
    const formattedCurrentTime = formatTime(currentTime);
    const formattedDuration = formatTime(duration);

    return (
        <div className='flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/20 bg-black max-h-[60vh]'>
            <div
                className='relative flex min-h-0 flex-1 items-center justify-center bg-black'
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onFocus={() => setIsHovering(true)}
                onBlur={() => setIsHovering(false)}
            >
                <video
                    ref={videoRef}
                    // Never derive the src from anything that can change while
                    // the clip plays (it used to carry a `#t=` fragment only
                    // until a poster arrived, which reloaded the element).
                    src={videoSrc}
                    poster={thumbnailSrc || undefined}
                    className='h-full w-full max-h-full object-contain'
                    style={{ display: 'block', outline: 'none' }}
                    preload='auto'
                    playsInline
                    onClick={handleTogglePlayback}
                    onPlay={() => {
                        playingRef.current = true;
                        setIsPlaying(true);
                        setHasInteracted(true);
                    }}
                    onPause={() => {
                        playingRef.current = false;
                        setIsPlaying(false);
                    }}
                    onEnded={(event) => {
                        playingRef.current = false;
                        setIsPlaying(false);
                        setCurrentTime(event.currentTarget.duration || 0);
                    }}
                    onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        setDuration(video.duration || 0);

                        const resume = pendingResumeRef.current;
                        pendingResumeRef.current = null;
                        if (resume && resume.time > 0 && resume.time < (video.duration || Infinity)) {
                            video.currentTime = resume.time;
                            if (resume.playing) void video.play().catch(() => {});
                            return;
                        }
                        // Without a poster the element paints black until it
                        // has decoded a frame — nudge it past zero.
                        if (!thumbnailSrc && video.currentTime === 0) {
                            video.currentTime = 0.001;
                        }
                    }}
                    onTimeUpdate={(event) => {
                        const time = event.currentTarget.currentTime;
                        setCurrentTime(time);
                        // A reload reports 0 before it reports anything real;
                        // keeping it would defeat the resume above.
                        if (time > 0) positionRef.current = time;
                    }}
                    onError={(error) => {
                        console.warn('Video playback error; attempting to resolve another source.', error);
                        onSourceError?.();
                    }}
                />

                <button
                    type='button'
                    onClick={handleTogglePlayback}
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 focus:outline-none ${
                        showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                >
                    <span className='rounded-full bg-black/70 p-4 text-white shadow-lg backdrop-blur-sm'>
                        {isPlaying ? <Pause className='h-8 w-8' /> : <Play className='h-8 w-8' />}
                    </span>
                </button>
            </div>

            <div className='flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-3'>
                <span className='w-12 text-xs font-medium text-white/80 tabular-nums'>{formattedCurrentTime}</span>
                <Slider
                    value={[Math.min(currentTime, safeDuration)]}
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    onValueChange={handleSliderChange}
                    onValueCommit={handleSliderCommit}
                    disabled={duration === 0}
                    className='flex-1'
                    aria-label='Video progress'
                />
                <span className='w-12 text-right text-xs font-medium text-white/60 tabular-nums'>
                    {formattedDuration}
                </span>
            </div>
        </div>
    );
}
