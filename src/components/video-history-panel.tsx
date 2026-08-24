'use client';

import { AssemblyEditor } from '@/components/assembly-editor';
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
import { db } from '@/lib/db';
import { resolveMediaState } from '@/lib/media-state';
import type { CaptionSegment } from '@/lib/captions';
import type { UserAsset } from '@/lib/media-archive';
import { estimateVideoProgress } from '@/lib/progress';
import { cn } from '@/lib/utils';
import type { VideoMetadata, VideoJob } from '@/types/video';
import {
    Check,
    CloudOff,
    CloudUpload,
    Copy,
    Download,
    DollarSign,
    Film,
    Loader2,
    PencilLine,
    RefreshCw,
    Rocket,
    RotateCcw,
    Search,
    Share2,
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
    hasLocalCopy: (id: string) => boolean;
    onDeleteItem?: (item: VideoMetadata) => void;
    /** 做同款 — fill the create form with this item's parameters. */
    onReuseItem?: (item: VideoMetadata) => void;
    /** 重新生成 — resubmit this item's parameters as a new job. */
    onRegenerateItem?: (item: VideoMetadata) => void;
    /** Finalize — rerun this draft at its selected final resolution. */
    onFinalizeItem?: (item: VideoMetadata) => void;
    /** 续片 — continue this completed video from its last frame. */
    onExtendItem?: (item: VideoMetadata) => void;
    /** Share — create a public share page for this completed video. */
    onShareItem?: (item: VideoMetadata) => void;
    /** Retry permanent R2 archival for a completed item. */
    onRetryArchive?: (id: string) => void | Promise<void>;
    archivePendingIds?: Set<string>;
    sharePendingId?: string | null;
    /** Fetches user audio assets for the assembly editor's BGM picker. */
    loadAudioAssets?: () => Promise<UserAsset[]>;
    /** Transcribes an assembled film for the assembly editor's captions flow. */
    onTranscribeVideo?: (blob: Blob) => Promise<CaptionSegment[]>;
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

type StatusFilter = 'all' | 'completed' | 'processing' | 'archiving' | 'failed';

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'processing', label: 'Processing' },
    { id: 'archiving', label: 'Archiving' },
    { id: 'failed', label: 'Failed' }
];

function getHistoryItemState(item: VideoMetadata, job?: VideoJob, hasPlayableMedia = false) {
    const isFailed = job?.status === 'failed' || item.status === 'failed';
    const isCompleted =
        !isFailed && (hasPlayableMedia || job?.status === 'completed' || (item.status ?? 'completed') === 'completed');
    const isProcessing =
        !isCompleted &&
        !isFailed &&
        (item.status === 'processing' || job?.status === 'queued' || job?.status === 'in_progress');

    return { isProcessing, isFailed, isCompleted };
}

function hasTokenCostDetails(costDetails: VideoMetadata['costDetails']): boolean {
    return Boolean(
        costDetails &&
            typeof costDetails.tokens === 'number' &&
            Number.isFinite(costDetails.tokens) &&
            typeof costDetails.unitPricePerMillionTokens === 'number' &&
            Number.isFinite(costDetails.unitPricePerMillionTokens)
    );
}

function formatTokens(tokens: number): string {
    return Math.round(tokens).toLocaleString();
}

export function VideoHistoryPanel({
    history,
    activeJobs,
    onSelectVideo,
    onClearHistory,
    getVideoSrc,
    getThumbnailSrc,
    hasLocalCopy,
    onDeleteItem,
    onReuseItem,
    onRegenerateItem,
    onFinalizeItem,
    onExtendItem,
    onShareItem,
    onRetryArchive,
    archivePendingIds,
    sharePendingId,
    loadAudioAssets,
    onTranscribeVideo
}: VideoHistoryPanelProps) {
    const [openCostDialogId, setOpenCostDialogId] = React.useState<string | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [modelFilter, setModelFilter] = React.useState<string>('all');
    const [promptQuery, setPromptQuery] = React.useState('');
    const [isAssembleMode, setIsAssembleMode] = React.useState(false);
    const [selectedClipIds, setSelectedClipIds] = React.useState<string[]>([]);
    const [assembleError, setAssembleError] = React.useState<string | null>(null);
    const [isAssemblyEditorOpen, setIsAssemblyEditorOpen] = React.useState(false);
    const [hoverPreviewId, setHoverPreviewId] = React.useState<string | null>(null);

    const getMediaState = React.useCallback(
        (item: VideoMetadata) =>
            resolveMediaState(
                item,
                { hasBlob: hasLocalCopy(item.id) },
                Date.now()
            ),
        [hasLocalCopy]
    );

    const canAssembleItem = React.useCallback(
        (item: VideoMetadata, job?: VideoJob) => {
            if (!getHistoryItemState(item, job).isCompleted || getMediaState(item) === 'expired') return false;
            return hasLocalCopy(item.id) || Boolean(getVideoSrc(item.id) ?? item.storedUrl);
        },
        [getMediaState, getVideoSrc, hasLocalCopy]
    );

    /** Models actually present in history, for the filter row. */
    const modelsInHistory = React.useMemo(() => {
        return Array.from(new Set(history.map((item) => item.model)));
    }, [history]);

    const historyById = React.useMemo(() => {
        return new Map(history.map((item) => [item.id, item]));
    }, [history]);

    const completedClipCount = React.useMemo(() => {
        return history.filter((item) => canAssembleItem(item, activeJobs?.get(item.id))).length;
    }, [history, activeJobs, canAssembleItem]);

    const filteredHistory = React.useMemo(() => {
        const query = promptQuery.trim().toLowerCase();
        return history.filter((item) => {
            if (statusFilter !== 'all') {
                const job = activeJobs?.get(item.id);
                const mediaState = getMediaState(item);
                const hasPlayableMedia = mediaState !== 'expired' && (hasLocalCopy(item.id) || Boolean(getVideoSrc(item.id) ?? item.storedUrl));
                const state = getHistoryItemState(item, job, hasPlayableMedia);
                const needsCloudArchive = state.isCompleted && !item.storedUrl && mediaState !== 'expired';
                const derivedStatus = state.isFailed
                    ? 'failed'
                    : needsCloudArchive
                      ? 'archiving'
                      : state.isCompleted
                        ? 'completed'
                        : 'processing';
                if (derivedStatus !== statusFilter) return false;
            }
            if (modelFilter !== 'all' && item.model !== modelFilter) return false;
            if (query && !item.prompt.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [history, statusFilter, modelFilter, promptQuery, activeJobs, getMediaState, getVideoSrc, hasLocalCopy]);

    const selectedItems = React.useMemo(() => {
        return selectedClipIds
            .map((id) => historyById.get(id))
            .filter((item): item is VideoMetadata => Boolean(item))
            .filter((item) => canAssembleItem(item, activeJobs?.get(item.id)));
    }, [selectedClipIds, historyById, activeJobs, canAssembleItem]);

    const selectedSizes = React.useMemo(() => {
        return Array.from(new Set(selectedItems.map((item) => item.size).filter(Boolean)));
    }, [selectedItems]);

    const hasMixedSelectedSizes = selectedSizes.length > 1;
    const selectedSizeLabel =
        selectedItems.length === 0 ? '' : hasMixedSelectedSizes ? 'Mixed sizes' : selectedSizes[0] || 'Unknown size';
    const selectedSummary = selectedSizeLabel
        ? `${selectedItems.length} clips selected · ${selectedSizeLabel}`
        : `${selectedItems.length} clips selected`;
    const canOpenAssemblyEditor = selectedItems.length >= 2 && !hasMixedSelectedSizes;

    const { totalCost, totalVideos, successfulVideos, failedVideos, billedVideos } = React.useMemo(() => {
        let cost = 0;
        let videos = 0;
        let successful = 0;
        let failed = 0;
        let billed = 0;
        history.forEach((item) => {
            const state = getHistoryItemState(item, activeJobs?.get(item.id));
            if (item.costDetails && state.isCompleted) {
                cost += item.costDetails.totalCost;
                billed += 1;
            }
            if (state.isCompleted) {
                successful += 1;
            }
            if (state.isFailed) {
                failed += 1;
            }
            videos += 1;
        });

        return {
            totalCost: Math.round(cost * 100) / 100,
            totalVideos: videos,
            successfulVideos: successful,
            failedVideos: failed,
            billedVideos: billed
        };
    }, [history, activeJobs]);

    const averageCost = billedVideos > 0 ? totalCost / billedVideos : 0;
    const totalCostSummary = `Total Billed $${totalCost.toFixed(2)} · ${totalVideos.toLocaleString()} videos${
        failedVideos > 0 ? ` (${failedVideos.toLocaleString()} failed)` : ''
    }`;

    const resetAssembleState = React.useCallback(() => {
        setSelectedClipIds([]);
        setAssembleError(null);
        setIsAssemblyEditorOpen(false);
    }, []);

    const exitAssembleMode = React.useCallback(() => {
        setIsAssembleMode(false);
        resetAssembleState();
    }, [resetAssembleState]);

    const toggleAssembleMode = React.useCallback(() => {
        setIsAssembleMode((current) => {
            if (current) {
                resetAssembleState();
            } else {
                setAssembleError(null);
            }

            return !current;
        });
    }, [resetAssembleState]);

    React.useEffect(() => {
        setSelectedClipIds((current) => {
            const next = current.filter((id) => {
                const item = historyById.get(id);
                return item ? canAssembleItem(item, activeJobs?.get(id)) : false;
            });

            return next.length === current.length ? current : next;
        });
    }, [historyById, activeJobs, canAssembleItem]);

    React.useEffect(() => {
        if (completedClipCount < 2 && isAssembleMode) {
            setIsAssembleMode(false);
            resetAssembleState();
        }
    }, [completedClipCount, isAssembleMode, resetAssembleState]);

    const handleToggleClipSelection = React.useCallback(
        (item: VideoMetadata, isCompleted: boolean) => {
            if (!isAssembleMode || !isCompleted) return;

            setSelectedClipIds((current) => {
                if (current.includes(item.id)) {
                    return current.filter((id) => id !== item.id);
                }

                return [...current, item.id];
            });
            setAssembleError(null);
        },
        [isAssembleMode]
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

    const handleOpenAssemblyEditor = React.useCallback(() => {
        if (selectedItems.length < 2) {
            setAssembleError('Select at least two completed clips.');
            return;
        }

        if (hasMixedSelectedSizes) {
            setAssembleError('Selected clips must share the same size before export.');
            return;
        }

        setAssembleError(null);
        setIsAssemblyEditorOpen(true);
    }, [hasMixedSelectedSizes, selectedItems.length]);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <AssemblyEditor
                open={isAssemblyEditorOpen}
                onOpenChange={setIsAssemblyEditorOpen}
                items={selectedItems}
                resolveClipBlob={resolveClipBlob}
                loadAudioAssets={loadAudioAssets}
                onTranscribeVideo={onTranscribeVideo}
            />
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div className='flex items-center gap-2'>
                    <CardTitle className='text-lg font-medium text-white'>History</CardTitle>
                    {totalCost > 0 && (
                        <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                            <DialogTrigger asChild>
                                <button
                                    className='mt-0.5 flex items-center gap-1 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[12px] text-white transition-colors hover:bg-green-500/90'
                                    aria-label='Show total cost summary'>
                                    Total Billed: ${totalCost.toFixed(2)}
                                </button>
                            </DialogTrigger>
                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                <DialogHeader>
                                    <DialogTitle className='text-white'>Total Cost Summary</DialogTitle>
                                    <DialogDescription className='sr-only'>
                                        A summary of the total billed cost for all generated videos in the history.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white'>
                                    {totalCostSummary}
                                </div>
                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                    <p>Seedance billing is token-based and charged only after successful completion.</p>
                                    <p>Reference video estimates are lower bounds because provider floors may apply.</p>
                                </div>
                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                    <div className='flex justify-between'>
                                        <span>Total Videos Generated:</span> <span>{totalVideos.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>Successful Videos:</span> <span>{successfulVideos.toLocaleString()}</span>
                                    </div>
                                    {failedVideos > 0 && (
                                        <div className='flex justify-between'>
                                            <span>Failed Videos:</span> <span>{failedVideos.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className='flex justify-between'>
                                        <span>Average Cost Per Video:</span> <span>${averageCost.toFixed(2)}</span>
                                    </div>
                                    <hr className='my-2 border-neutral-700' />
                                    <div className='flex justify-between font-medium text-white'>
                                        <span>Total Billed Cost:</span>
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
                                    const videoUrl = getVideoSrc(item.id) ?? item.storedUrl;
                                    const job = activeJobs?.get(item.id);
                                    const mediaState = getMediaState(item);
                                    const hasPlayableMedia =
                                        mediaState !== 'expired' && (hasLocalCopy(item.id) || Boolean(videoUrl));
                                    const { isProcessing, isFailed, isCompleted } = getHistoryItemState(
                                        item,
                                        job,
                                        hasPlayableMedia
                                    );
                                    const isExpired = isCompleted && mediaState === 'expired';
                                    const canPlayPreview =
                                        isCompleted &&
                                        !isExpired &&
                                        Boolean(videoUrl) &&
                                        (mediaState === 'local' ||
                                            mediaState === 'archived' ||
                                            mediaState === 'provider');
                                    const showHoverPreview = hoverPreviewId === item.id && canPlayPreview;
                                    const canSelectForAssembly = canAssembleItem(item, job);
                                    const needsCloudArchive = isCompleted && !item.storedUrl && !isExpired;
                                    const isDraft = item.draft === true || item.createParams?.draft === true;
                                    const selectionOrder = selectedClipIds.indexOf(item.id) + 1;
                                    const isSelectedForAssembly = selectionOrder > 0;
                                    const isSharePending = sharePendingId === item.id;
                                    const isArchivePending = archivePendingIds?.has(item.id) ?? false;
                                    const costDetails = item.costDetails;
                                    const tokenCostDetails = hasTokenCostDetails(costDetails);
                                    const displayProgress = isProcessing
                                        ? estimateVideoProgress(
                                              job?.created_at ?? item.timestamp / 1000,
                                              item.seconds,
                                              Math.max(item.progress || 0, job?.progress || 0),
                                              Date.now()
                                          )
                                        : 100;

                                    return (
                                        <div key={item.id} className='flex flex-col'>
                                            <div className='group relative'>
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        if (isAssembleMode) {
                                                            handleToggleClipSelection(item, canSelectForAssembly);
                                                            return;
                                                        }

                                                        onSelectVideo(item);
                                                    }}
                                                    onMouseEnter={() => {
                                                        if (canPlayPreview) setHoverPreviewId(item.id);
                                                    }}
                                                    onMouseLeave={() => {
                                                        setHoverPreviewId((current) =>
                                                            current === item.id ? null : current
                                                        );
                                                    }}
                                                    className={cn(
                                                        'relative block aspect-square w-full overflow-hidden rounded-t-md border border-white/20 transition-all duration-150 group-hover:border-white/40 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none',
                                                        isExpired && 'border-white/10 opacity-75',
                                                        isAssembleMode && canSelectForAssembly && 'cursor-pointer',
                                                        isAssembleMode &&
                                                            !canSelectForAssembly &&
                                                            'cursor-not-allowed opacity-60',
                                                        isSelectedForAssembly && 'border-white ring-2 ring-white/40'
                                                    )}
                                                    aria-label={
                                                        isAssembleMode
                                                            ? `${isSelectedForAssembly ? 'Remove' : 'Select'} clip ${item.id} for assembly`
                                                            : `View video from ${new Date(item.timestamp).toLocaleString()}`
                                                    }
                                                    aria-pressed={
                                                        isAssembleMode && canSelectForAssembly
                                                            ? isSelectedForAssembly
                                                            : undefined
                                                    }>
                                                    {isProcessing ? (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-neutral-900'>
                                                            <Loader2 className='mb-2 h-8 w-8 animate-spin text-white/40' />
                                                            <span className='text-xs text-white/60'>
                                                                {job?.status === 'queued'
                                                                    ? 'Queued'
                                                                    : `${displayProgress}%`}
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
                                                    ) : isExpired ? (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-neutral-950 p-3 text-center text-white/40'>
                                                            <Film className='mb-2 h-8 w-8 text-white/20' />
                                                            <span className='text-xs font-medium text-white/55'>
                                                                Media expired
                                                            </span>
                                                            <span className='mt-1 text-[10px] text-white/30'>
                                                                {item.size}
                                                            </span>
                                                        </div>
                                                    ) : showHoverPreview && videoUrl ? (
                                                        <video
                                                            // Plain src: deriving it from the poster made the
                                                            // element reload the moment a poster arrived.
                                                            src={videoUrl}
                                                            poster={thumbnailUrl}
                                                            className='h-full w-full object-cover'
                                                            muted
                                                            autoPlay
                                                            loop
                                                            preload='auto'
                                                            playsInline
                                                            onError={(error) =>
                                                                console.warn('Preview playback failed:', error)
                                                            }
                                                        />
                                                    ) : thumbnailUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={thumbnailUrl}
                                                            alt=''
                                                            className='h-full w-full object-cover'
                                                        />
                                                    ) : canPlayPreview ? (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-neutral-900 p-3 text-center text-white/55'>
                                                            <Film className='mb-2 h-8 w-8 text-white/35' />
                                                            <span className='text-xs font-medium text-white/70'>
                                                                Ready
                                                            </span>
                                                            <span className='mt-1 text-[10px] text-white/35'>
                                                                Click to preview
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-neutral-900 p-3 text-center text-white/40'>
                                                            <Film className='mb-2 h-8 w-8 text-white/25' />
                                                            <span className='text-[10px] text-white/45'>
                                                                {item.size}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isAssembleMode && canSelectForAssembly ? (
                                                        <div className='pointer-events-none absolute top-1 left-1 z-30 flex h-6 w-6 items-center justify-center rounded border border-white/60 bg-black/70 text-[11px] font-medium text-white backdrop-blur'>
                                                            {isSelectedForAssembly ? selectionOrder : null}
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className='pointer-events-none absolute top-1 left-1 z-10 flex flex-wrap items-center gap-1'>
                                                            <div
                                                                className={cn(
                                                                    'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-white',
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
                                                            {isDraft && (
                                                                <div className='rounded-full bg-cyan-600/85 px-1.5 py-0.5 text-[11px] text-white'>
                                                                    Draft
                                                                </div>
                                                            )}
                                                            {needsCloudArchive && (
                                                                <div
                                                                    className='flex items-center gap-1 rounded-full bg-amber-600/85 px-1.5 py-0.5 text-[11px] text-white'
                                                                    title='Not archived to cloud yet — the provider link expires 24h after completion'>
                                                                    <CloudOff size={12} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className='pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1'>
                                                        <div className='flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/80 px-1 py-0.5 text-[11px] text-white/70'>
                                                            <span>{item.seconds}s</span>
                                                        </div>
                                                    </div>
                                                </button>
                                                {!isAssembleMode && isFailed && (
                                                    <div
                                                        className='absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full bg-neutral-700/90 px-1.5 py-0.5 text-[11px] text-white'
                                                        title='Failed generations are free'>
                                                        <DollarSign size={12} />
                                                        Free
                                                    </div>
                                                )}
                                                {!isAssembleMode && !isFailed && costDetails && (
                                                    <Dialog
                                                        open={openCostDialogId === item.id}
                                                        onOpenChange={(isOpen) => !isOpen && setOpenCostDialogId(null)}>
                                                        <DialogTrigger asChild>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenCostDialogId(item.id);
                                                                }}
                                                                className={cn(
                                                                    'absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] text-white transition-colors',
                                                                    isFailed
                                                                        ? 'bg-amber-600/90 hover:bg-amber-500/90'
                                                                        : 'bg-green-600/80 hover:bg-green-500/90'
                                                                )}
                                                                aria-label='Show cost breakdown'>
                                                                <DollarSign size={12} />
                                                                {costDetails.lowerBound ? 'from ' : ''}
                                                                {costDetails.totalCost.toFixed(2)}
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                                            <DialogHeader>
                                                                <DialogTitle className='text-white'>
                                                                    Cost Breakdown
                                                                </DialogTitle>
                                                                <DialogDescription className='sr-only'>
                                                                    Billed cost breakdown for this video generation.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                                                <div className='flex justify-between'>
                                                                    <span>Model:</span>{' '}
                                                                    <span>{costDetails.model}</span>
                                                                </div>
                                                                {tokenCostDetails && (
                                                                    <div className='flex justify-between'>
                                                                        <span>Ratio:</span>{' '}
                                                                        <span>{costDetails.ratio}</span>
                                                                    </div>
                                                                )}
                                                                <div className='flex justify-between'>
                                                                    <span>Resolution:</span>{' '}
                                                                    <span>{costDetails.resolution}</span>
                                                                </div>
                                                                <div className='flex justify-between'>
                                                                    <span>Output Duration:</span>{' '}
                                                                    <span>{costDetails.duration}s</span>
                                                                </div>
                                                                {tokenCostDetails ? (
                                                                    <>
                                                                        {costDetails.inputVideoSeconds > 0 && (
                                                                            <div className='flex justify-between'>
                                                                                <span>Input Video:</span>{' '}
                                                                                <span>
                                                                                    {costDetails.inputVideoSeconds.toFixed(
                                                                                        1
                                                                                    )}
                                                                                    s
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        <div className='flex justify-between'>
                                                                            <span>Pixels:</span>{' '}
                                                                            <span>
                                                                                {costDetails.width} x{' '}
                                                                                {costDetails.height} @{' '}
                                                                                {costDetails.fps} fps
                                                                            </span>
                                                                        </div>
                                                                        <div className='flex justify-between'>
                                                                            <span>Tokens:</span>{' '}
                                                                            <span>{formatTokens(costDetails.tokens)}</span>
                                                                        </div>
                                                                        <div className='flex justify-between'>
                                                                            <span>Unit Price:</span>{' '}
                                                                            <span>
                                                                                $
                                                                                {costDetails.unitPricePerMillionTokens.toFixed(
                                                                                    2
                                                                                )}
                                                                                /1M tokens
                                                                            </span>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className='flex justify-between'>
                                                                        <span>Price Per Second:</span>{' '}
                                                                        <span>${costDetails.pricePerSecond.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                <hr className='my-2 border-neutral-700' />
                                                                <div className='flex justify-between font-medium text-white'>
                                                                    <span>
                                                                        {costDetails.lowerBound ? 'Estimated From:' : 'Cost:'}
                                                                    </span>
                                                                    <span>${costDetails.totalCost.toFixed(2)}</span>
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
                                                                    : 'Delete this video from your history? This removes it from browser storage and attempts to remove the archived cloud copy.';
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
                                                {(onReuseItem ||
                                                    onRegenerateItem ||
                                                    onFinalizeItem ||
                                                    onExtendItem ||
                                                    onShareItem ||
                                                    onRetryArchive) &&
                                                    !isProcessing &&
                                                    !isAssembleMode && (
                                                        <div className='mt-1.5 flex flex-wrap items-center gap-1'>
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
                                                            {onRetryArchive && needsCloudArchive && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => void onRetryArchive(item.id)}
                                                                    disabled={isArchivePending}
                                                                    title={
                                                                        isArchivePending
                                                                            ? 'Archiving to cloud'
                                                                            : 'Archive now'
                                                                    }
                                                                    className={cn(
                                                                        'flex flex-1 items-center justify-center gap-1 rounded bg-amber-500/15 px-1.5 py-1 text-[10px] text-amber-100 transition-colors hover:bg-amber-500/25 hover:text-white',
                                                                        isArchivePending &&
                                                                            'cursor-wait opacity-70 hover:bg-amber-500/15 hover:text-amber-100'
                                                                    )}>
                                                                    {isArchivePending ? (
                                                                        <Loader2 size={11} className='animate-spin' />
                                                                    ) : (
                                                                        <CloudUpload size={11} />
                                                                    )}
                                                                    {isArchivePending ? 'Archiving...' : 'Archive now'}
                                                                </button>
                                                            )}
                                                            {onShareItem && isCompleted && !isExpired && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onShareItem(item)}
                                                                    disabled={!item.storedUrl || isSharePending}
                                                                    title={
                                                                        item.storedUrl
                                                                            ? 'Share this video'
                                                                            : 'Archive to cloud first — wait a moment'
                                                                    }
                                                                    className={cn(
                                                                        'flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white',
                                                                        (!item.storedUrl || isSharePending) &&
                                                                            'cursor-not-allowed opacity-40 hover:bg-white/10 hover:text-white/70'
                                                                    )}>
                                                                    {isSharePending ? (
                                                                        <Loader2 size={11} className='animate-spin' />
                                                                    ) : (
                                                                        <Share2 size={11} />
                                                                    )}
                                                                    Share
                                                                </button>
                                                            )}
                                                            {onExtendItem && isCompleted && !isExpired && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onExtendItem(item)}
                                                                    title='Continue from the last frame'
                                                                    className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                                    <StepForward size={11} />
                                                                    Extend
                                                                </button>
                                                            )}
                                                            {onFinalizeItem && isCompleted && isDraft && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onFinalizeItem(item)}
                                                                    title='Generate the final version at the selected resolution'
                                                                    className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                                    <Rocket size={11} />
                                                                    Finalize
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
                                    </div>
                                    <div className='flex shrink-0 items-center gap-2'>
                                        <Button
                                            type='button'
                                            size='sm'
                                            variant='ghost'
                                            onClick={exitAssembleMode}
                                            className='h-8 rounded-md px-2 text-white/60 hover:bg-white/10 hover:text-white'>
                                            <X size={14} />
                                            Cancel
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            onClick={handleOpenAssemblyEditor}
                                            disabled={!canOpenAssemblyEditor}
                                            className='h-8 rounded-md bg-white px-3 text-black hover:bg-white/90'>
                                            <Download size={14} />
                                            Edit & Export
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
