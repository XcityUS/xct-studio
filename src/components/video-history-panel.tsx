'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { assembleClips } from '@/lib/assemble';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import type { VideoMetadata, VideoJob } from '@/types/video';
import {
    Check,
    Copy,
    Download,
    DollarSign,
    Film,
    Loader2,
    PencilLine,
    RefreshCw,
    RotateCcw,
    Search,
    Sparkles as SparklesIcon,
    StepForward,
    Trash2,
    X
} from 'lucide-react';
import * as React from 'react';

type VideoHistoryPanelProps = {
    history: VideoMetadata[];
    activeJobs?: Map<string, VideoJob>;
    onSelectVideo: (item: VideoMetadata) => void;
    onClearHistory: () => void;
    getVideoSrc: (id: string) => string | undefined;
    getThumbnailSrc?: (id: string) => string | undefined;
    onDeleteItem?: (item: VideoMetadata) => void;
    /** 做同款 — fill the create form with this item's parameters. */
    onReuseItem?: (item: VideoMetadata) => void;
    /** 重新生成 — resubmit this item's parameters as a new job. */
    onRegenerateItem?: (item: VideoMetadata) => void;
    /** 续片 — continue this completed video from its last frame. */
    onExtendItem?: (item: VideoMetadata) => void;
};

/**
 * Prompt line on a history tile: click to expand the full text, copy icon to
 * grab it. The prompt is stored with every video, so this is where users
 * retrieve it.
 */
function TilePrompt({ prompt }: { prompt: string }) {
    const [expanded, setExpanded] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy prompt:', err);
        }
    };

    return (
        <div className='flex items-start gap-1'>
            <p
                className={cn('flex-1 cursor-pointer text-xs text-white/70', !expanded && 'line-clamp-1')}
                title={expanded ? 'Collapse prompt' : 'Show full prompt'}
                onClick={() => setExpanded((v) => !v)}>
                {prompt}
            </p>
            <button
                type='button'
                onClick={handleCopy}
                title='Copy prompt'
                className='shrink-0 pt-0.5 text-white/40 transition-colors hover:text-white'>
                {copied ? <Check size={12} className='text-green-400' /> : <Copy size={12} />}
            </button>
        </div>
    );
}

type StatusFilter = 'all' | 'completed' | 'processing' | 'failed';

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'processing', label: 'Processing' },
    { id: 'failed', label: 'Failed' }
];

function getHistoryItemState(item: VideoMetadata, job?: VideoJob) {
    const isProcessing =
        item.status === 'processing' || (job && (job.status === 'queued' || job.status === 'in_progress'));
    const isFailed = item.status === 'failed' || (job && job.status === 'failed');
    const isCompleted = !isProcessing && !isFailed && (item.status ?? 'completed') === 'completed';

    return { isProcessing, isFailed, isCompleted };
}

export function VideoHistoryPanel({
    history,
    activeJobs,
    onSelectVideo,
    onClearHistory,
    getVideoSrc,
    getThumbnailSrc,
    onDeleteItem,
    onReuseItem,
    onRegenerateItem,
    onExtendItem
}: VideoHistoryPanelProps) {
    const [openCostDialogId, setOpenCostDialogId] = React.useState<string | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [modelFilter, setModelFilter] = React.useState<string>('all');
    const [promptQuery, setPromptQuery] = React.useState('');
    const [isAssembleMode, setIsAssembleMode] = React.useState(false);
    const [selectedClipIds, setSelectedClipIds] = React.useState<string[]>([]);
    const [isAssembling, setIsAssembling] = React.useState(false);
    const [assembleProgress, setAssembleProgress] = React.useState<number | null>(null);
    const [assembleError, setAssembleError] = React.useState<string | null>(null);

    /** Models actually present in history, for the filter row. */
    const modelsInHistory = React.useMemo(() => {
        return Array.from(new Set(history.map((item) => item.model)));
    }, [history]);

    const historyById = React.useMemo(() => {
        return new Map(history.map((item) => [item.id, item]));
    }, [history]);

    const completedClipCount = React.useMemo(() => {
        return history.filter((item) => getHistoryItemState(item, activeJobs?.get(item.id)).isCompleted).length;
    }, [history, activeJobs]);

    const filteredHistory = React.useMemo(() => {
        const query = promptQuery.trim().toLowerCase();
        return history.filter((item) => {
            if (statusFilter !== 'all' && (item.status ?? 'completed') !== statusFilter) return false;
            if (modelFilter !== 'all' && item.model !== modelFilter) return false;
            if (query && !item.prompt.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [history, statusFilter, modelFilter, promptQuery]);

    const selectedItems = React.useMemo(() => {
        return selectedClipIds
            .map((id) => historyById.get(id))
            .filter((item): item is VideoMetadata => Boolean(item))
            .filter((item) => getHistoryItemState(item, activeJobs?.get(item.id)).isCompleted);
    }, [selectedClipIds, historyById, activeJobs]);

    const selectedSizes = React.useMemo(() => {
        return Array.from(new Set(selectedItems.map((item) => item.size).filter(Boolean)));
    }, [selectedItems]);

    const hasMixedSelectedSizes = selectedSizes.length > 1;
    const selectedSizeLabel =
        selectedItems.length === 0 ? '' : hasMixedSelectedSizes ? 'Mixed sizes' : selectedSizes[0] || 'Unknown size';
    const selectedSummary = selectedSizeLabel
        ? `${selectedItems.length} clips selected · ${selectedSizeLabel}`
        : `${selectedItems.length} clips selected`;
    const canExportAssembly = selectedItems.length >= 2 && !hasMixedSelectedSizes && !isAssembling;

    const { totalCost, totalVideos, successfulVideos } = React.useMemo(() => {
        let cost = 0;
        let videos = 0;
        let successful = 0;
        history.forEach((item) => {
            // Only count cost for non-failed videos
            if (item.costDetails && item.status !== 'failed') {
                cost += item.costDetails.totalCost;
                successful += 1;
            }
            // Count all videos (including failed)
            videos += 1;
        });

        return { totalCost: Math.round(cost * 100) / 100, totalVideos: videos, successfulVideos: successful };
    }, [history]);

    const averageCost = successfulVideos > 0 ? totalCost / successfulVideos : 0;

    const resetAssembleState = React.useCallback(() => {
        setSelectedClipIds([]);
        setAssembleProgress(null);
        setAssembleError(null);
    }, []);

    const exitAssembleMode = React.useCallback(() => {
        if (isAssembling) return;
        setIsAssembleMode(false);
        resetAssembleState();
    }, [isAssembling, resetAssembleState]);

    const toggleAssembleMode = React.useCallback(() => {
        if (isAssembling) return;

        setIsAssembleMode((current) => {
            if (current) {
                resetAssembleState();
            } else {
                setAssembleError(null);
            }

            return !current;
        });
    }, [isAssembling, resetAssembleState]);

    React.useEffect(() => {
        setSelectedClipIds((current) => {
            const next = current.filter((id) => {
                const item = historyById.get(id);
                return item ? getHistoryItemState(item, activeJobs?.get(id)).isCompleted : false;
            });

            return next.length === current.length ? current : next;
        });
    }, [historyById, activeJobs]);

    React.useEffect(() => {
        if (completedClipCount < 2 && isAssembleMode && !isAssembling) {
            setIsAssembleMode(false);
            resetAssembleState();
        }
    }, [completedClipCount, isAssembleMode, isAssembling, resetAssembleState]);

    const handleToggleClipSelection = React.useCallback(
        (item: VideoMetadata, isCompleted: boolean) => {
            if (!isAssembleMode || !isCompleted || isAssembling) return;

            setSelectedClipIds((current) => {
                if (current.includes(item.id)) {
                    return current.filter((id) => id !== item.id);
                }

                return [...current, item.id];
            });
            setAssembleProgress(null);
            setAssembleError(null);
        },
        [isAssembleMode, isAssembling]
    );

    const resolveClipBlob = React.useCallback(
        async (item: VideoMetadata) => {
            const record = await db.videos.get(item.id);
            if (record?.blob) return record.blob;

            const src = getVideoSrc(item.id) ?? item.storedUrl;
            if (!src) {
                throw new Error(`Video source not found for ${item.filename || item.id}.`);
            }

            const response = await fetch(src);
            if (!response.ok) {
                throw new Error(`Could not load ${item.filename || item.id} (${response.status}).`);
            }

            return response.blob();
        },
        [getVideoSrc]
    );

    const handleExportAssembly = React.useCallback(async () => {
        if (selectedItems.length < 2) {
            setAssembleError('Select at least two completed clips.');
            return;
        }

        if (hasMixedSelectedSizes) {
            setAssembleError('Selected clips must share the same size before export.');
            return;
        }

        setIsAssembling(true);
        setAssembleError(null);
        setAssembleProgress(0);

        try {
            const clips = await Promise.all(
                selectedItems.map(async (item) => ({
                    id: item.id,
                    blob: await resolveClipBlob(item)
                }))
            );
            const blob = await assembleClips(clips, setAssembleProgress);
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const anchor = document.createElement('a');

            try {
                anchor.href = url;
                anchor.download = `assembled-${timestamp}.mp4`;
                document.body.appendChild(anchor);
                anchor.click();
            } finally {
                document.body.removeChild(anchor);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (err) {
            console.error('Error assembling clips:', err);
            setAssembleError(err instanceof Error ? err.message : 'Failed to assemble clips.');
        } finally {
            setIsAssembling(false);
        }
    }, [hasMixedSelectedSizes, resolveClipBlob, selectedItems]);

    const handlePreviewEnter = React.useCallback((video: HTMLVideoElement) => {
        const tryPlay = () => {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.warn('Preview playback failed:', error);
                });
            }
        };

        video.dataset.hoverPreview = 'true';
        video.currentTime = 0;

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            tryPlay();
            return;
        }

        const handleCanPlay = () => {
            video.removeEventListener('canplay', handleCanPlay);
            if (video.dataset.hoverPreview === 'true') {
                tryPlay();
            }
        };

        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.load();
    }, []);

    const handlePreviewLeave = React.useCallback((video: HTMLVideoElement) => {
        video.dataset.hoverPreview = 'false';
        video.pause();
        try {
            video.currentTime = 0;
        } catch (error) {
            console.warn('Unable to reset preview time:', error);
        }
    }, []);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div className='flex items-center gap-2'>
                    <CardTitle className='text-lg font-medium text-white'>History</CardTitle>
                    {totalCost > 0 && (
                        <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                            <DialogTrigger asChild>
                                <button
                                    className='mt-0.5 flex items-center gap-1 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[12px] text-white transition-colors hover:bg-green-500/90'
                                    aria-label='Show total cost summary'>
                                    Total Cost: ${totalCost.toFixed(2)}
                                </button>
                            </DialogTrigger>
                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                <DialogHeader>
                                    <DialogTitle className='text-white'>Total Cost Summary</DialogTitle>
                                    <DialogDescription className='sr-only'>
                                        A summary of the total estimated cost for all generated videos in the history.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                    <p>Seedance pricing (per second, 720p / 1080p):</p>
                                    <ul className='list-disc pl-4'>
                                        <li>Seedance 1.5 Pro: $0.052 / $0.117</li>
                                        <li>Seedance 2.0: $0.151 / $0.374</li>
                                        <li>Seedance 2.0 Fast: $0.121 / —</li>
                                    </ul>
                                </div>
                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                    <div className='flex justify-between'>
                                        <span>Total Videos Generated:</span> <span>{totalVideos.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>Average Cost Per Video:</span> <span>${averageCost.toFixed(2)}</span>
                                    </div>
                                    <hr className='my-2 border-neutral-700' />
                                    <div className='flex justify-between font-medium text-white'>
                                        <span>Total Estimated Cost:</span>
                                        <span>${totalCost.toFixed(2)}</span>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type='button'
                                            variant='secondary'
                                            size='sm'
                                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                            Close
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                <div className='flex items-center gap-2'>
                    {completedClipCount >= 2 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={toggleAssembleMode}
                            disabled={isAssembling}
                            className={cn(
                                'h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white',
                                isAssembleMode && 'bg-white text-black hover:bg-white hover:text-black'
                            )}>
                            <Film size={14} />
                            Assemble
                        </Button>
                    )}
                    {history.length > 0 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={onClearHistory}
                            disabled={isAssembling}
                            className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                            Clear
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {history.length === 0 ? (
                    <div className='flex h-full items-center justify-center text-white/40'>
                        <p>Generated videos will appear here.</p>
                    </div>
                ) : (
                    <>
                        <div className='mb-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 focus-within:border-white/30'>
                            <Search size={14} className='shrink-0 text-white/40' />
                            <input
                                type='text'
                                value={promptQuery}
                                onChange={(e) => setPromptQuery(e.target.value)}
                                placeholder='Search prompts…'
                                className='w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none'
                            />
                            {promptQuery && (
                                <button
                                    type='button'
                                    onClick={() => setPromptQuery('')}
                                    className='shrink-0 text-white/40 transition-colors hover:text-white'
                                    aria-label='Clear prompt search'>
                                    ×
                                </button>
                            )}
                        </div>
                        <div className='mb-4 flex flex-wrap items-center gap-2'>
                            {STATUS_FILTERS.map((f) => (
                                <button
                                    key={f.id}
                                    type='button'
                                    onClick={() => setStatusFilter(f.id)}
                                    className={cn(
                                        'rounded-full px-2.5 py-1 text-xs transition-colors',
                                        statusFilter === f.id
                                            ? 'bg-white text-black'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                                    )}>
                                    {f.label}
                                </button>
                            ))}
                            {modelsInHistory.length > 1 && (
                                <>
                                    <span className='mx-1 h-4 w-px bg-white/15' />
                                    <button
                                        type='button'
                                        onClick={() => setModelFilter('all')}
                                        className={cn(
                                            'rounded-full px-2.5 py-1 text-xs transition-colors',
                                            modelFilter === 'all'
                                                ? 'bg-white text-black'
                                                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                                        )}>
                                        All models
                                    </button>
                                    {modelsInHistory.map((m) => (
                                        <button
                                            key={m}
                                            type='button'
                                            onClick={() => setModelFilter(m)}
                                            className={cn(
                                                'rounded-full px-2.5 py-1 text-xs transition-colors',
                                                modelFilter === m
                                                    ? 'bg-white text-black'
                                                    : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                                            )}>
                                            {m}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                        {filteredHistory.length === 0 ? (
                            <div className='flex h-40 items-center justify-center text-white/40'>
                                <p>No videos match the current filter.</p>
                            </div>
                        ) : (
                            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                                {filteredHistory.map((item) => {
                                    const thumbnailUrl = getThumbnailSrc ? getThumbnailSrc(item.id) : undefined;
                                    const videoUrl = getVideoSrc(item.id);
                                    const job = activeJobs?.get(item.id);
                                    const { isProcessing, isFailed, isCompleted } = getHistoryItemState(item, job);
                                    const selectionOrder = selectedClipIds.indexOf(item.id) + 1;
                                    const isSelectedForAssembly = selectionOrder > 0;

                                    return (
                                        <div key={item.id} className='flex flex-col'>
                                            <div className='group relative'>
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        if (isAssembleMode) {
                                                            handleToggleClipSelection(item, isCompleted);
                                                            return;
                                                        }

                                                        onSelectVideo(item);
                                                    }}
                                                    className={cn(
                                                        'relative block aspect-square w-full overflow-hidden rounded-t-md border border-white/20 transition-all duration-150 group-hover:border-white/40 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none',
                                                        isAssembleMode && isCompleted && 'cursor-pointer',
                                                        isAssembleMode &&
                                                            !isCompleted &&
                                                            'cursor-not-allowed opacity-60',
                                                        isSelectedForAssembly && 'border-white ring-2 ring-white/40'
                                                    )}
                                                    aria-label={
                                                        isAssembleMode
                                                            ? `${isSelectedForAssembly ? 'Remove' : 'Select'} clip ${item.id} for assembly`
                                                            : `View video from ${new Date(item.timestamp).toLocaleString()}`
                                                    }
                                                    aria-pressed={
                                                        isAssembleMode && isCompleted
                                                            ? isSelectedForAssembly
                                                            : undefined
                                                    }>
                                                    {isProcessing ? (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-neutral-900'>
                                                            <Loader2 className='mb-2 h-8 w-8 animate-spin text-white/40' />
                                                            <span className='text-xs text-white/60'>
                                                                {job?.status === 'queued'
                                                                    ? 'Queued'
                                                                    : `${item.progress || job?.progress || 0}%`}
                                                            </span>
                                                        </div>
                                                    ) : isFailed ? (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-red-950 p-2 text-red-400'>
                                                            <span className='text-xs font-semibold'>Failed</span>
                                                            {item.error && (
                                                                <span className='mt-1 line-clamp-2 text-center text-[10px] text-red-300'>
                                                                    {item.error}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : videoUrl && item.status !== 'failed' ? (
                                                        <video
                                                            // Without a captured poster, a #t media fragment
                                                            // makes browsers (Safari included) paint the first
                                                            // frame instead of a blank box.
                                                            src={thumbnailUrl ? videoUrl : `${videoUrl}#t=0.001`}
                                                            poster={thumbnailUrl}
                                                            className='h-full w-full object-cover'
                                                            muted
                                                            preload='metadata'
                                                            playsInline
                                                            onMouseEnter={(event) =>
                                                                handlePreviewEnter(event.currentTarget)
                                                            }
                                                            onMouseLeave={(event) =>
                                                                handlePreviewLeave(event.currentTarget)
                                                            }
                                                        />
                                                    ) : (
                                                        <div className='flex h-full w-full items-center justify-center bg-neutral-800 text-neutral-500'>
                                                            ?
                                                        </div>
                                                    )}
                                                    {isAssembleMode && isCompleted ? (
                                                        <div className='pointer-events-none absolute top-1 left-1 z-30 flex h-6 w-6 items-center justify-center rounded border border-white/60 bg-black/70 text-[11px] font-medium text-white backdrop-blur'>
                                                            {isSelectedForAssembly ? selectionOrder : null}
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={cn(
                                                                'pointer-events-none absolute top-1 left-1 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-white',
                                                                item.mode === 'remix'
                                                                    ? 'bg-orange-600/80'
                                                                    : 'bg-blue-600/80'
                                                            )}>
                                                            {item.mode === 'remix' ? (
                                                                <RefreshCw size={12} />
                                                            ) : (
                                                                <SparklesIcon size={12} />
                                                            )}
                                                            {item.mode === 'remix' ? 'Remix' : 'Create'}
                                                        </div>
                                                    )}
                                                    <div className='pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1'>
                                                        <div className='flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 px-1 py-0.5 text-[11px] text-white/70'>
                                                            <span>{item.seconds}s</span>
                                                        </div>
                                                    </div>
                                                </button>
                                                {!isAssembleMode && item.costDetails && item.status !== 'failed' && (
                                                    <Dialog
                                                        open={openCostDialogId === item.id}
                                                        onOpenChange={(isOpen) => !isOpen && setOpenCostDialogId(null)}>
                                                        <DialogTrigger asChild>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenCostDialogId(item.id);
                                                                }}
                                                                className='absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[11px] text-white transition-colors hover:bg-green-500/90'
                                                                aria-label='Show cost breakdown'>
                                                                <DollarSign size={12} />
                                                                {item.costDetails.totalCost.toFixed(2)}
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                                            <DialogHeader>
                                                                <DialogTitle className='text-white'>
                                                                    Cost Breakdown
                                                                </DialogTitle>
                                                                <DialogDescription className='sr-only'>
                                                                    Estimated cost breakdown for this video generation.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                                                <div className='flex justify-between'>
                                                                    <span>Model:</span>{' '}
                                                                    <span>{item.costDetails.model}</span>
                                                                </div>
                                                                <div className='flex justify-between'>
                                                                    <span>Resolution:</span>{' '}
                                                                    <span>{item.costDetails.resolution}</span>
                                                                </div>
                                                                <div className='flex justify-between'>
                                                                    <span>Duration:</span>{' '}
                                                                    <span>{item.costDetails.duration}s</span>
                                                                </div>
                                                                <div className='flex justify-between'>
                                                                    <span>Price Per Second:</span>{' '}
                                                                    <span>
                                                                        ${item.costDetails.pricePerSecond.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <hr className='my-2 border-neutral-700' />
                                                                <div className='flex justify-between font-medium text-white'>
                                                                    <span>Total Cost:</span>
                                                                    <span>
                                                                        ${item.costDetails.totalCost.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <DialogFooter>
                                                                <DialogClose asChild>
                                                                    <Button
                                                                        type='button'
                                                                        variant='secondary'
                                                                        size='sm'
                                                                        className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                                                        Close
                                                                    </Button>
                                                                </DialogClose>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                                {!isAssembleMode && onDeleteItem && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const message =
                                                                item.status === 'failed'
                                                                    ? 'Are you sure you want to delete this failed request from your history?'
                                                                    : 'Delete this video from your history? This removes it from your browser storage. Archived cloud copies are not affected.';
                                                            if (confirm(message)) {
                                                                onDeleteItem(item);
                                                            }
                                                        }}
                                                        className='absolute right-1 bottom-1 z-20 flex items-center gap-0.5 rounded-full bg-red-600/80 p-1 text-white transition-colors hover:bg-red-500/90'
                                                        aria-label='Delete video'>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className='rounded-b-md border border-t-0 border-white/20 bg-neutral-900/50 p-2'>
                                                <TilePrompt prompt={item.prompt} />
                                                <div className='mt-1 flex items-center justify-between text-[10px] text-white/40'>
                                                    <span>{item.model}</span>
                                                    <span>{item.size}</span>
                                                </div>
                                                {(onReuseItem || onRegenerateItem || onExtendItem) &&
                                                    !isProcessing &&
                                                    !isAssembleMode && (
                                                        <div className='mt-1.5 flex items-center gap-1'>
                                                            {onReuseItem && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onReuseItem(item)}
                                                                    title='Fill the create form with these settings'
                                                                    className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                                    <PencilLine size={11} />
                                                                    Reuse
                                                                </button>
                                                            )}
                                                            {onExtendItem && isCompleted && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onExtendItem(item)}
                                                                    title='Continue from the last frame'
                                                                    className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                                    <StepForward size={11} />
                                                                    Extend
                                                                </button>
                                                            )}
                                                            {onRegenerateItem && item.status !== 'failed' && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onRegenerateItem(item)}
                                                                    title='Generate again with the same settings (new cost)'
                                                                    className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                                    <RotateCcw size={11} />
                                                                    Regenerate
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {isAssembleMode && (
                            <div className='sticky bottom-0 z-40 mt-4 rounded-md border border-white/15 bg-neutral-950/95 p-3 shadow-lg backdrop-blur'>
                                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                    <div className='min-w-0 space-y-1'>
                                        <div className='truncate text-sm font-medium text-white'>{selectedSummary}</div>
                                        {hasMixedSelectedSizes ? (
                                            <div className='text-xs text-red-300'>
                                                Selected clips must share the same size before export.
                                            </div>
                                        ) : assembleError ? (
                                            <div className='text-xs text-red-300'>{assembleError}</div>
                                        ) : (
                                            <div className='text-xs text-white/45'>
                                                Select completed clips in export order.
                                            </div>
                                        )}
                                        {assembleProgress !== null && (
                                            <div className='flex items-center gap-2 pt-1'>
                                                <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'>
                                                    <div
                                                        className='h-full rounded-full bg-white transition-all duration-200'
                                                        style={{ width: `${Math.round(assembleProgress * 100)}%` }}
                                                    />
                                                </div>
                                                <span className='w-9 text-right text-[11px] text-white/55'>
                                                    {Math.round(assembleProgress * 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className='flex shrink-0 items-center gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='ghost'
                                            onClick={exitAssembleMode}
                                            disabled={isAssembling}
                                            className='h-8 rounded-md px-2 text-white/60 hover:bg-white/10 hover:text-white'>
                                            <X size={14} />
                                            Cancel
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            onClick={handleExportAssembly}
                                            disabled={!canExportAssembly}
                                            className='h-8 rounded-md bg-white px-3 text-black hover:bg-white/90'>
                                            {isAssembling ? (
                                                <Loader2 size={14} className='animate-spin' />
                                            ) : (
                                                <Download size={14} />
                                            )}
                                            Export
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
