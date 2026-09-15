'use client';

import { CardSkeleton } from './CardSkeleton';
import { TileTitle } from './TileTitle';
import { TotalCostDialog } from './TotalCostDialog';
import { WatermarkDialog } from './WatermarkDialog';
import { MAX_CONCURRENT_WATERMARKS, MAX_WATERMARK_TEXT_LENGTH, STATUS_FILTERS } from './constants';
import styles from './index.module.scss';
import type { StatusFilter, VideoHistoryPanelProps } from './types';
import { formatTokens, formatVideoMegabytes, getHistoryItemState, hasTokenCostDetails, newestHistoryFirst } from './utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/Dialog';
import { resolveMediaState } from '@/features/assets/media/state';
import { db } from '@/features/assets/storage/db';
import { estimateVideoProgress } from '@/features/generation/utils/progress';
import { AssemblyEditor } from '@/features/post-production/components/AssemblyEditor';
import { modelSupportsFinalize } from '@/shared/config/seedance';
import type { VideoJob, VideoMetadata } from '@/shared/contracts/video';
import { cn } from '@/shared/utils/classnames';
import {
    CloudOff,
    CloudUpload,
    DollarSign,
    Download,
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
import { useTranslations } from 'next-intl';
import * as React from 'react';

const VIDEO_PAGE_SIZE = 15;

export function VideoHistoryPanel({
    history,
    activeJobs,
    isInitialLoad = false,
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
    extendPendingIds,
    onShareItem,
    onAddWatermark,
    onRemoveWatermark,
    onRenameItem,
    onRetryArchive,
    archivePendingIds,
    sharePendingId,
    watermarkPendingIds,
    watermarkActiveId,
    loadAudioAssets,
    onTranscribeVideo
}: VideoHistoryPanelProps) {
    const t = useTranslations();
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
    const [watermarkDialogItem, setWatermarkDialogItem] = React.useState<VideoMetadata | null>(null);
    const [useCustomWatermark, setUseCustomWatermark] = React.useState(false);
    const [customWatermarkText, setCustomWatermarkText] = React.useState('');
    const [visibleCount, setVisibleCount] = React.useState(VIDEO_PAGE_SIZE);
    const [isLoadingNextPage, setIsLoadingNextPage] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const loadingTimerRef = React.useRef<number | null>(null);

    const openWatermarkDialog = React.useCallback((item: VideoMetadata) => {
        setWatermarkDialogItem(item);
        setUseCustomWatermark(false);
        setCustomWatermarkText('');
    }, []);

    const handleWatermarkDialogOpenChange = React.useCallback((open: boolean) => {
        if (!open) {
            setWatermarkDialogItem(null);
            setUseCustomWatermark(false);
            setCustomWatermarkText('');
        }
    }, []);

    const handleConfirmAddWatermark = React.useCallback(() => {
        if (!watermarkDialogItem) return;
        const text = useCustomWatermark ? customWatermarkText.trim().slice(0, MAX_WATERMARK_TEXT_LENGTH) : undefined;
        void onAddWatermark?.(watermarkDialogItem, text || undefined);
        handleWatermarkDialogOpenChange(false);
    }, [customWatermarkText, handleWatermarkDialogOpenChange, onAddWatermark, useCustomWatermark, watermarkDialogItem]);

    const getMediaState = React.useCallback(
        (item: VideoMetadata) => resolveMediaState(item, { hasBlob: hasLocalCopy(item.id) }, Date.now()),
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
                const hasPlayableMedia =
                    mediaState !== 'expired' &&
                    (hasLocalCopy(item.id) || Boolean(getVideoSrc(item.id) ?? item.storedUrl));
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
            if (query && !`${item.title ?? ''} ${item.prompt}`.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [history, statusFilter, modelFilter, promptQuery, activeJobs, getMediaState, getVideoSrc, hasLocalCopy]);

    const visibleHistory = React.useMemo(() => {
        return newestHistoryFirst(filteredHistory).slice(0, visibleCount);
    }, [filteredHistory, visibleCount]);
    const hasMoreHistory = visibleCount < filteredHistory.length;
    const loadingPlaceholderCount = isLoadingNextPage
        ? Math.min(VIDEO_PAGE_SIZE, filteredHistory.length - visibleCount)
        : 0;

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
        selectedItems.length === 0
            ? ''
            : hasMixedSelectedSizes
              ? t('Mixed sizes')
              : selectedSizes[0] || t('Unknown size');
    const selectedSummary = selectedSizeLabel
        ? t('<lcur>count<rcur> clips selected at <lcur>size<rcur>', {
              count: selectedItems.length,
              size: selectedSizeLabel
          })
        : t('<lcur>count<rcur> clips selected', { count: selectedItems.length });
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
        setVisibleCount(Math.min(VIDEO_PAGE_SIZE, filteredHistory.length));
        setIsLoadingNextPage(false);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
    }, [filteredHistory]);

    const loadMoreVideos = React.useCallback(() => {
        if (!hasMoreHistory || isLoadingNextPage) return;
        setIsLoadingNextPage(true);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }

        loadingTimerRef.current = window.setTimeout(() => {
            setVisibleCount((current) => Math.min(current + VIDEO_PAGE_SIZE, filteredHistory.length));
            setIsLoadingNextPage(false);
            loadingTimerRef.current = null;
        }, 180);
    }, [filteredHistory.length, hasMoreHistory, isLoadingNextPage]);

    const handleHistoryScroll = React.useCallback(
        (event: React.UIEvent<HTMLDivElement>) => {
            const target = event.currentTarget;
            const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (remaining <= 120) loadMoreVideos();
        },
        [loadMoreVideos]
    );

    React.useEffect(() => {
        if (!hasMoreHistory) return;

        const handleWindowScroll = () => {
            const target = contentRef.current;
            if (!target || target.scrollHeight > target.clientHeight + 1) return;

            const remaining = target.getBoundingClientRect().bottom - window.innerHeight;
            if (remaining <= 160) loadMoreVideos();
        };

        window.addEventListener('scroll', handleWindowScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleWindowScroll);
    }, [hasMoreHistory, loadMoreVideos]);

    React.useEffect(() => {
        return () => {
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        };
    }, []);

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

    const resolveClipBlob = async (item: VideoMetadata) => {
        const record = await db.videos.get(item.id);
        if (record?.blob) return record.blob;
        const src = getVideoSrc(item.id) ?? item.storedUrl;
        if (!src) throw new Error(t('Video source not found for <lcur>name<rcur>', { name: item.filename || item.id }));
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error(
                t('Could not load <lcur>name<rcur> <lpar><lcur>status<rcur><rpar>', {
                    name: item.filename || item.id,
                    status: response.status
                })
            );
        }
        return response.blob();
    };

    const handleOpenAssemblyEditor = () => {
        if (selectedItems.length < 2) {
            setAssembleError(t('Select at least two completed clips'));
            return;
        }

        if (hasMixedSelectedSizes) {
            setAssembleError(t('Selected clips must share the same size before export'));
            return;
        }

        setAssembleError(null);
        setIsAssemblyEditorOpen(true);
    };

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
                    <CardTitle className='text-lg font-medium text-white'>{t('History')}</CardTitle>
                    {totalCost > 0 && (
                        <TotalCostDialog
                            open={isTotalCostDialogOpen}
                            totalCost={totalCost}
                            totalVideos={totalVideos}
                            successfulVideos={successfulVideos}
                            failedVideos={failedVideos}
                            billedVideos={billedVideos}
                            onOpenChange={setIsTotalCostDialogOpen}
                        />
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
                            {t('Assemble')}
                        </Button>
                    )}
                    {history.length > 0 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={onClearHistory}
                            className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                            {t('Clear')}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className='flex-grow p-4'>
                <div className='h-full overflow-y-auto' ref={contentRef} onScroll={handleHistoryScroll}>
                {isInitialLoad ? (
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                        {Array.from({ length: VIDEO_PAGE_SIZE }).map((_, index) => (
                            <CardSkeleton key={`history-initial-skeleton-${index}`} />
                        ))}
                    </div>
                ) : history.length === 0 ? (
                    <div className='flex h-full items-center justify-center text-white/40'>
                        <p>{t('Generated videos will appear here')}</p>
                    </div>
                ) : (
                    <>
                        <div className='mb-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 focus-within:border-white/30'>
                            <Search size={14} className='shrink-0 text-white/40' />
                            <input
                                type='text'
                                value={promptQuery}
                                onChange={(e) => setPromptQuery(e.target.value)}
                                placeholder={t('Search prompts')}
                                className='w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none'
                            />
                            {promptQuery && (
                                <button
                                    type='button'
                                    onClick={() => setPromptQuery('')}
                                    className='shrink-0 text-white/40 transition-colors hover:text-white'
                                    aria-label={t('Clear prompt search')}>
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
                                    {
                                        {
                                            all: t('All'),
                                            completed: t('Completed'),
                                            processing: t('Processing'),
                                            archiving: t('Archiving'),
                                            failed: t('Failed')
                                        }[f.id]
                                    }
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
                                        {t('All models')}
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
                                <p>{t('No videos match the current filter')}</p>
                            </div>
                        ) : (
                            <>
                            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                                {visibleHistory.map((item) => {
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
                                    const finalizeDisabledReason = modelSupportsFinalize(item.model)
                                        ? null
                                        : t('Finalize is only available for Seedance 2<dot>5 drafts');
                                    const selectionOrder = selectedClipIds.indexOf(item.id) + 1;
                                    const isSelectedForAssembly = selectionOrder > 0;
                                    const isSharePending = sharePendingId === item.id;
                                    const isArchivePending = archivePendingIds?.has(item.id) ?? false;
                                    const hasBrandingWatermark = item.brandingWatermark?.enabled === true;
                                    const canAddWatermark =
                                        Boolean(onAddWatermark) && isCompleted && !isExpired && !hasBrandingWatermark;
                                    const canRemoveWatermark =
                                        Boolean(onRemoveWatermark) && isCompleted && !isExpired && hasBrandingWatermark;
                                    const canRestoreOriginal = Boolean(item.brandingWatermark?.originalUrl);
                                    const videoSizeLabel = formatVideoMegabytes(item.fileSizeBytes);
                                    const isWatermarkPending = watermarkPendingIds?.has(item.id) ?? false;
                                    const isWatermarkActive = watermarkActiveId === item.id;
                                    const watermarkSlotsFull =
                                        (watermarkPendingIds?.size ?? 0) >= MAX_CONCURRENT_WATERMARKS;
                                    const isWatermarkActionDisabled = isWatermarkPending || watermarkSlotsFull;
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
                                        <div
                                            key={item.id}
                                            className={cn('flex flex-col', styles.card)}
                                            data-finalize-flag={item.finalizeFlag ?? undefined}>
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
                                                        styles.mediaButton,
                                                        'aspect-square transition-opacity duration-150',
                                                        isExpired && 'opacity-75',
                                                        isAssembleMode && canSelectForAssembly && 'cursor-pointer',
                                                        isAssembleMode &&
                                                            !canSelectForAssembly &&
                                                            'cursor-not-allowed opacity-60',
                                                        isSelectedForAssembly && styles.selectedMedia
                                                    )}
                                                    aria-label={
                                                        isAssembleMode
                                                            ? isSelectedForAssembly
                                                                ? t('Remove clip <lcur>id<rcur> from assembly', {
                                                                      id: item.id
                                                                  })
                                                                : t('Select clip <lcur>id<rcur> for assembly', {
                                                                      id: item.id
                                                                  })
                                                            : t('View video from <lcur>date<rcur>', {
                                                                  date: new Date(item.timestamp).toLocaleString()
                                                              })
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
                                                                {item.status === 'submitting'
                                                                    ? t('Submitting<hellip>')
                                                                    : job?.status === 'queued'
                                                                      ? t('Queued')
                                                                      : `${displayProgress}%`}
                                                            </span>
                                                            {item.status === 'submitting' && (
                                                                <span className='mt-1 px-3 text-center text-[10px] text-white/35'>
                                                                    {t('Request status unknown after refresh')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : isFailed ? (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-red-950 p-2 text-red-400'>
                                                            <span className='text-xs font-semibold'>{t('Failed')}</span>
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
                                                                {t('Media expired')}
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
                                                    ) : canPlayPreview && videoUrl ? (
                                                        <video
                                                            src={`${videoUrl}#t=0.1`}
                                                            className='h-full w-full object-cover'
                                                            muted
                                                            preload='metadata'
                                                            playsInline
                                                            onError={(error) =>
                                                                console.warn('Poster fallback playback failed:', error)
                                                            }
                                                        />
                                                    ) : (
                                                        <div className='flex h-full w-full flex-col items-center justify-center bg-neutral-900 p-3 text-center text-white/40'>
                                                            <Film className='mb-2 h-8 w-8 text-white/25' />
                                                            <span className='text-[10px] text-white/45'>
                                                                {item.size}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isAssembleMode && canSelectForAssembly ? (
                                                        <div className='pointer-events-none absolute top-1 left-1 z-30 flex h-6 w-6 items-center justify-center rounded border border-[var(--studio-media-border)] bg-[var(--studio-media-overlay)] text-[11px] font-medium text-[var(--studio-media-foreground)] backdrop-blur'>
                                                            {isSelectedForAssembly ? selectionOrder : null}
                                                        </div>
                                                    ) : (
                                                        <div className='pointer-events-none absolute top-1 left-1 z-10 flex flex-wrap items-center gap-1'>
                                                            <div
                                                                className={cn(
                                                                    styles.modeBadge,
                                                                    'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px]'
                                                                )}>
                                                                {item.mode === 'remix' ? (
                                                                    <RefreshCw size={12} />
                                                                ) : (
                                                                    <SparklesIcon size={12} />
                                                                )}
                                                                {item.mode === 'remix' ? t('Remix') : t('Create')}
                                                            </div>
                                                            {isDraft && (
                                                                <div
                                                                    className={cn(
                                                                        styles.draftBadge,
                                                                        'rounded-full px-1.5 py-0.5 text-[11px]'
                                                                    )}>
                                                                    {t('Draft')}
                                                                </div>
                                                            )}
                                                            {hasBrandingWatermark && (
                                                                <div
                                                                    className={cn(
                                                                        styles.watermarkBadge,
                                                                        'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px]'
                                                                    )}
                                                                    title={t(
                                                                        'Current version has a visible watermark'
                                                                    )}>
                                                                    <SparklesIcon size={12} />
                                                                    {t('Mark')}
                                                                </div>
                                                            )}
                                                            {needsCloudArchive && (
                                                                <div
                                                                    className={cn(
                                                                        styles.archiveBadge,
                                                                        'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px]'
                                                                    )}
                                                                    title={t(
                                                                        'Not archived to cloud yet <mdash> the provider link expires 24h after completion'
                                                                    )}>
                                                                    <CloudOff size={12} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className='pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1'>
                                                        <div
                                                            className={cn(
                                                                styles.mediaMeta,
                                                                'flex items-center gap-1 rounded-full px-1 py-0.5 text-[11px]'
                                                            )}>
                                                            <span>{item.seconds}s</span>
                                                        </div>
                                                        {videoSizeLabel && (
                                                            <div
                                                                className={cn(
                                                                    styles.mediaMeta,
                                                                    'rounded-full px-1 py-0.5 text-[11px]'
                                                                )}>
                                                                {videoSizeLabel}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                                {!isAssembleMode && isFailed && (
                                                    <div
                                                        className={cn(
                                                            styles.costBadge,
                                                            'absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px]'
                                                        )}
                                                        title={t('Failed generations are free')}>
                                                        <DollarSign size={12} />
                                                        {t('Free')}
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
                                                                    styles.costBadge,
                                                                    'absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] transition-opacity hover:opacity-80'
                                                                )}
                                                                aria-label={t('Show cost breakdown')}>
                                                                <DollarSign size={12} />
                                                                {costDetails.lowerBound ? `${t('from')} ` : ''}
                                                                {costDetails.totalCost.toFixed(2)}
                                                            </button>
                                                        </DialogTrigger>
                                                        <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                                            <DialogHeader>
                                                                <DialogTitle className='text-white'>
                                                                    {t('Cost Breakdown')}
                                                                </DialogTitle>
                                                                <DialogDescription className='sr-only'>
                                                                    {t(
                                                                        'Billed cost breakdown for this video generation'
                                                                    )}
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                                                <div className='flex justify-between'>
                                                                    <span>{t('Model<colon>')}</span>{' '}
                                                                    <span>{costDetails.model}</span>
                                                                </div>
                                                                {tokenCostDetails && (
                                                                    <div className='flex justify-between'>
                                                                        <span>{t('Ratio<colon>')}</span>{' '}
                                                                        <span>{costDetails.ratio}</span>
                                                                    </div>
                                                                )}
                                                                <div className='flex justify-between'>
                                                                    <span>{t('Resolution<colon>')}</span>{' '}
                                                                    <span>{costDetails.resolution}</span>
                                                                </div>
                                                                <div className='flex justify-between'>
                                                                    <span>{t('Output Duration<colon>')}</span>{' '}
                                                                    <span>{costDetails.duration}s</span>
                                                                </div>
                                                                {tokenCostDetails ? (
                                                                    <>
                                                                        {costDetails.inputVideoSeconds > 0 && (
                                                                            <div className='flex justify-between'>
                                                                                <span>{t('Input Video<colon>')}</span>{' '}
                                                                                <span>
                                                                                    {costDetails.inputVideoSeconds.toFixed(
                                                                                        1
                                                                                    )}
                                                                                    s
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        <div className='flex justify-between'>
                                                                            <span>{t('Pixels<colon>')}</span>{' '}
                                                                            <span>
                                                                                {costDetails.width} x{' '}
                                                                                {costDetails.height} @ {costDetails.fps}{' '}
                                                                                fps
                                                                            </span>
                                                                        </div>
                                                                        <div className='flex justify-between'>
                                                                            <span>{t('Tokens<colon>')}</span>{' '}
                                                                            <span>
                                                                                {formatTokens(costDetails.tokens)}
                                                                            </span>
                                                                        </div>
                                                                        <div className='flex justify-between'>
                                                                            <span>{t('Unit Price<colon>')}</span>{' '}
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
                                                                        <span>{t('Price Per Second<colon>')}</span>{' '}
                                                                        <span>
                                                                            ${costDetails.pricePerSecond.toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <hr className='my-2 border-neutral-700' />
                                                                <div className='flex justify-between font-medium text-white'>
                                                                    <span>
                                                                        {costDetails.lowerBound
                                                                            ? t('Estimated From<colon>')
                                                                            : t('Cost<colon>')}
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
                                                                        {t('Close')}
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
                                                                    ? t(
                                                                          'Are you sure you want to delete this failed request from your history<q>'
                                                                      )
                                                                    : t(
                                                                          'Delete this video from your history<q> This removes it from browser storage and attempts to remove the archived cloud copy'
                                                                      );
                                                            if (confirm(message)) {
                                                                onDeleteItem(item);
                                                            }
                                                        }}
                                                        className={cn(
                                                            styles.deleteButton,
                                                            'absolute right-1 bottom-1 z-20 flex items-center gap-0.5 rounded-full p-1 transition-colors'
                                                        )}
                                                        aria-label={t('Delete video')}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className={styles.details}>
                                                <TileTitle
                                                    prompt={item.prompt}
                                                    sourcePrompt={item.createParams?.caption_source_prompt}
                                                    title={item.title}
                                                    onTitleChange={
                                                        onRenameItem ? (title) => onRenameItem(item, title) : undefined
                                                    }
                                                />
                                                <div className={styles.metadata}>
                                                    <span>{item.model}</span>
                                                    <span>{item.size}</span>
                                                </div>
                                                {(onReuseItem ||
                                                    onRegenerateItem ||
                                                    onFinalizeItem ||
                                                    onExtendItem ||
                                                    onShareItem ||
                                                    onAddWatermark ||
                                                    onRemoveWatermark ||
                                                    onRetryArchive) &&
                                                    !isProcessing &&
                                                    !isAssembleMode && (
                                                        <div className={styles.actions}>
                                                            {onReuseItem && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onReuseItem(item)}
                                                                    title={t(
                                                                        'Fill the create form with these settings'
                                                                    )}
                                                                    className={styles.actionButton}>
                                                                    <PencilLine size={11} />
                                                                    {t('Use')}
                                                                </button>
                                                            )}
                                                            {onRetryArchive && needsCloudArchive && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => void onRetryArchive(item.id)}
                                                                    disabled={isArchivePending}
                                                                    title={
                                                                        isArchivePending
                                                                            ? t('Archiving to cloud<hellip>')
                                                                            : t('Archive now')
                                                                    }
                                                                    className={styles.actionButton}>
                                                                    {isArchivePending ? (
                                                                        <Loader2 size={11} className='animate-spin' />
                                                                    ) : (
                                                                        <CloudUpload size={11} />
                                                                    )}
                                                                    {isArchivePending
                                                                        ? t('Saving')
                                                                        : t('Save')}
                                                                </button>
                                                            )}
                                                            {canAddWatermark && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => openWatermarkDialog(item)}
                                                                    disabled={isWatermarkActionDisabled}
                                                                    title={
                                                                        isWatermarkPending
                                                                            ? isWatermarkActive
                                                                                ? t('Adding watermark<hellip>')
                                                                                : t('Queued for watermark processing')
                                                                            : watermarkSlotsFull
                                                                              ? t(
                                                                                    'Two watermarks are already being processed'
                                                                                )
                                                                              : t('Add Xcity branding watermark')
                                                                    }
                                                                    className={styles.actionButton}>
                                                                    {isWatermarkActive ? (
                                                                        <Loader2 size={11} className='animate-spin' />
                                                                    ) : (
                                                                        <SparklesIcon size={11} className='shrink-0' />
                                                                    )}
                                                                    {isWatermarkActive
                                                                        ? t('Adding<hellip>')
                                                                        : isWatermarkPending
                                                                          ? t('Queued')
                                                                          : t('Mark')}
                                                                </button>
                                                            )}
                                                            {canRemoveWatermark && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => void onRemoveWatermark?.(item)}
                                                                    disabled={isWatermarkPending || !canRestoreOriginal}
                                                                    title={
                                                                        canRestoreOriginal
                                                                            ? t(
                                                                                  'Switch back to original unwatermarked video'
                                                                              )
                                                                            : t(
                                                                                  'Original unwatermarked video is unavailable'
                                                                              )
                                                                    }
                                                                    className={styles.actionButton}>
                                                                    <X size={11} className='shrink-0' />
                                                                    {t('Orig')}
                                                                </button>
                                                            )}
                                                            {onShareItem && isCompleted && !isExpired && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onShareItem(item)}
                                                                    disabled={!item.storedUrl || isSharePending}
                                                                    title={
                                                                        item.storedUrl
                                                                            ? t('Share this video')
                                                                            : t(
                                                                                  'Archive to cloud first <mdash> wait a moment'
                                                                              )
                                                                    }
                                                                    className={styles.actionButton}>
                                                                    {isSharePending ? (
                                                                        <Loader2 size={11} className='animate-spin' />
                                                                    ) : (
                                                                        <Share2 size={11} />
                                                                    )}
                                                                    {t('Share')}
                                                                </button>
                                                            )}
                                                            {onExtendItem && isCompleted && !isExpired && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onExtendItem(item)}
                                                                    disabled={extendPendingIds?.has(item.id)}
                                                                    title={t('Continue from the last frame')}
                                                                    className={styles.actionButton}>
                                                                    {extendPendingIds?.has(item.id) ? (
                                                                        <Loader2 size={11} className='animate-spin' />
                                                                    ) : (
                                                                        <StepForward size={11} />
                                                                    )}
                                                                    {extendPendingIds?.has(item.id)
                                                                        ? t('Preparing')
                                                                        : t('More')}
                                                                </button>
                                                            )}
                                                            {onFinalizeItem && isCompleted && isDraft && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => {
                                                                        if (!finalizeDisabledReason) {
                                                                            onFinalizeItem(item);
                                                                        }
                                                                    }}
                                                                    disabled={Boolean(finalizeDisabledReason)}
                                                                    title={
                                                                        finalizeDisabledReason ??
                                                                        t(
                                                                            'Review settings and generate a paid final version'
                                                                        )
                                                                    }
                                                                    className={styles.actionButton}>
                                                                    <Rocket size={11} />
                                                                    {t('Final')}
                                                                </button>
                                                            )}
                                                            {onRegenerateItem && item.status !== 'failed' && (
                                                                <button
                                                                    type='button'
                                                                    onClick={() => onRegenerateItem(item)}
                                                                    title={t(
                                                                        'Generate again with the same settings <lpar>new cost<rpar>'
                                                                    )}
                                                                    className={styles.actionButton}>
                                                                    <RotateCcw size={11} />
                                                                    {t('Again')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {isLoadingNextPage &&
                                    Array.from({ length: loadingPlaceholderCount }).map((_, index) => (
                                        <CardSkeleton key={`history-page-skeleton-${index}`} />
                                    ))}
                            </div>
                            </>
                        )}
                        {isAssembleMode && (
                            <div className='sticky bottom-0 z-40 mt-4 rounded-md border border-white/15 bg-neutral-950/95 p-3 shadow-lg backdrop-blur'>
                                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                    <div className='min-w-0 space-y-1'>
                                        <div className='truncate text-sm font-medium text-white'>{selectedSummary}</div>
                                        {hasMixedSelectedSizes ? (
                                            <div className='text-xs text-red-300'>
                                                {t('Selected clips must share the same size before export')}
                                            </div>
                                        ) : assembleError ? (
                                            <div className='text-xs text-red-300'>{assembleError}</div>
                                        ) : (
                                            <div className='text-xs text-white/45'>
                                                {t('Select completed clips in export order')}
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
                                            {t('Cancel')}
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            onClick={handleOpenAssemblyEditor}
                                            disabled={!canOpenAssemblyEditor}
                                            className='h-8 rounded-md bg-white px-3 text-black hover:bg-white/90'>
                                            <Download size={14} />
                                            {t('Edit <and> Export')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
                </div>
            </CardContent>
            <WatermarkDialog
                open={Boolean(watermarkDialogItem)}
                useCustomWatermark={useCustomWatermark}
                customWatermarkText={customWatermarkText}
                onOpenChange={handleWatermarkDialogOpenChange}
                onUseCustomWatermarkChange={setUseCustomWatermark}
                onCustomWatermarkTextChange={(text) => setCustomWatermarkText(text.slice(0, MAX_WATERMARK_TEXT_LENGTH))}
                onConfirm={handleConfirmAddWatermark}
            />
        </Card>
    );
}
