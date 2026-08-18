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
    Share2,
    Sparkles,
    StepForward
} from 'lucide-react';
import * as React from 'react';

type VideoOutputProps = {
    job: VideoJob | null;
    videoSrc: string | null | undefined;
    thumbnailSrc?: string | null | undefined;
    isLoading: boolean;
    onSendToRemix?: (videoId: string) => void;
    onDownload?: (videoId: string) => void;
    onExtend?: (videoId: string) => void;
    onFinalize?: (videoId: string) => void;
    onShare?: (item: VideoMetadata) => void;
    shareItem?: VideoMetadata;
    isSharePending?: boolean;
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
    isLoading,
    onSendToRemix,
    onDownload,
    onExtend,
    onFinalize,
    onShare,
    shareItem,
    isSharePending
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
        job?.status === 'completed' && typeof videoSrc === 'string'
            ? { job, videoSrc }
            : null;
    const isCompletedWithVideo = Boolean(completedOutput);

    return (
        <Card className='flex h-full w-full flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='border-b border-white/10 pb-4'>
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
                    'flex min-h-0 flex-1 flex-col p-4',
                    isCompletedWithVideo ? 'items-stretch justify-start gap-4' : 'items-center justify-center'
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

                {job && job.status === 'completed' && !completedOutput && (
                    <div className='flex flex-col items-center justify-center text-center'>
                        {thumbnailSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={thumbnailSrc}
                                alt='Video first frame'
                                className='mb-4 max-h-64 rounded-lg border border-white/10 object-contain'
                            />
                        ) : (
                            <Loader2 className='mb-4 h-12 w-12 animate-spin text-white/60' />
                        )}
                        <p className='text-white/60'>Video ready — loading preview…</p>
                        <p className='mt-2 text-sm text-white/40'>
                            Fetching the finished video from the gateway — long clips (30s / 4K) can take a few
                            minutes of provider post-processing before the link appears
                        </p>
                    </div>
                )}

                {completedOutput && (
                    <div className='flex h-full min-h-0 w-full flex-col gap-4'>
                        <CompletedVideoPlayer
                            key={completedOutput.job.id}
                            jobId={completedOutput.job.id}
                            videoSrc={completedOutput.videoSrc}
                            thumbnailSrc={thumbnailSrc}
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
            </CardContent>
        </Card>
    );
}

type CompletedVideoPlayerProps = {
    jobId: string;
    videoSrc: string;
    thumbnailSrc?: string | null | undefined;
};

function CompletedVideoPlayer({ jobId, videoSrc, thumbnailSrc }: CompletedVideoPlayerProps) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [hasInteracted, setHasInteracted] = React.useState(false);
    const [isHovering, setIsHovering] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);

    React.useEffect(() => {
        const video = videoRef.current;
        setIsPlaying(false);
        setHasInteracted(false);
        setCurrentTime(0);
        setDuration(0);

        if (video) {
            video.pause();
            try {
                video.currentTime = 0;
            } catch (error) {
                console.warn('Unable to reset video currentTime:', error);
            }
        }
    }, [jobId, videoSrc]);

    const handleTogglePlayback = React.useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused || video.ended) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.error('Video playback failed to start:', error);
                });
            }
        } else {
            video.pause();
        }
    }, []);

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
                    // The #t fragment forces browsers to paint the first frame
                    // when no poster was captured (e.g. CDN-only playback).
                    src={thumbnailSrc ? videoSrc : `${videoSrc}#t=0.001`}
                    poster={thumbnailSrc || undefined}
                    className='h-full w-full max-h-full object-contain'
                    style={{ display: 'block', outline: 'none' }}
                    preload='auto'
                    playsInline
                    onClick={handleTogglePlayback}
                    onPlay={() => {
                        setIsPlaying(true);
                        setHasInteracted(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={(event) => {
                        setIsPlaying(false);
                        setCurrentTime(event.currentTarget.duration || 0);
                    }}
                    onLoadedMetadata={(event) => {
                        setDuration(event.currentTarget.duration || 0);
                    }}
                    onTimeUpdate={(event) => {
                        setCurrentTime(event.currentTarget.currentTime);
                    }}
                    onError={(error) => console.error('Video playback error:', error)}
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
