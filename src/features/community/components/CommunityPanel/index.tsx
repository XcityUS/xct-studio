'use client';

import styles from './index.module.scss';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { studioVideoSharePath } from '@/features/studio/routing';
import type { AppLocale } from '@/i18n/routing';
import type { CommunityListItem, CommunityQueueItem, CommunityReviewAction } from '@/lib/media-archive';
import { Check, ExternalLink, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

const COMMUNITY_BATCH_SIZE = 15;

type CommunityPanelProps = {
    loadItems: () => Promise<CommunityListItem[]>;
    loadQueue: () => Promise<CommunityQueueItem[] | null>;
    reviewItem: (shareId: string, action: CommunityReviewAction) => Promise<void>;
    onRecreate: (shareId: string) => void;
    active: boolean;
};

function formatDate(value: string, locale: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function paramsSummary(params: CommunityListItem['params']): string {
    const seconds = params.seconds === undefined || params.seconds === '' ? '' : `${params.seconds}s`;
    return [params.model, params.ratio, params.resolution, seconds].filter(Boolean).join(' / ');
}

function PreviewVideo({ url, title }: { url: string; title: string }) {
    return (
        <video
            src={`${url}#t=0.001`}
            aria-label={title}
            className='h-full w-full object-cover'
            muted
            preload='metadata'
            playsInline
            onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
            onMouseLeave={(event) => {
                event.currentTarget.pause();
                event.currentTarget.currentTime = 0;
            }}
        />
    );
}

function CommunityTile({ item, onRecreate }: { item: CommunityListItem; onRecreate: (shareId: string) => void }) {
    const t = useTranslations();
    const locale = useLocale() as AppLocale;
    const title = item.title || t('Xcity Studio video');
    const summary = paramsSummary(item.params);
    const shareUrl = studioVideoSharePath(locale, item.id);

    return (
        <div className='flex min-w-0 flex-col'>
            <div className='relative aspect-square w-full overflow-hidden rounded-t-md border border-white/20 bg-neutral-900'>
                <PreviewVideo url={item.video_url} title={title} />
            </div>
            <div className='flex min-h-[124px] flex-col rounded-b-md border border-t-0 border-white/20 bg-neutral-900/50 p-3'>
                <div className='min-w-0 space-y-1.5'>
                    <div className='truncate text-sm font-medium text-white' title={title}>
                        {title}
                    </div>
                    <p className='truncate text-xs leading-5 text-white/55' title={item.prompt}>
                        {item.prompt}
                    </p>
                </div>
                <div className='mt-auto space-y-2 pt-3'>
                    <div className='flex items-center justify-between gap-2 text-[10px] text-white/35'>
                        <span className='truncate'>{summary}</span>
                        <span className='shrink-0'>{formatDate(item.created_at, locale)}</span>
                    </div>
                    <div className='flex flex-wrap items-center gap-1.5'>
                        <button
                            type='button'
                            onClick={() => onRecreate(item.id)}
                            className='flex min-w-[5.75rem] flex-1 items-center justify-center gap-1 rounded bg-white px-2 py-1.5 text-[11px] font-medium text-black transition-colors hover:bg-white/90'>
                            <RotateCcw size={12} />
                            {t('Recreate')}
                        </button>
                        <a
                            href={shareUrl}
                            target='_blank'
                            rel='noreferrer'
                            className='flex min-w-[5.75rem] flex-1 items-center justify-center gap-1 rounded bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                            <ExternalLink size={12} />
                            {t('Open page')}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CommunityTileSkeleton({ count }: { count: number }) {
    return (
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' aria-hidden='true'>
            {Array.from({ length: count }).map((_, index) => (
                <div className={styles.skeletonCard} key={`community-skeleton-${index}`}>
                    <div className={styles.skeletonPreview} />
                    <div className={styles.skeletonBody}>
                        <div className={styles.skeletonTitle} />
                        <div className={styles.skeletonPrompt} />
                        <div className={styles.skeletonMeta} />
                        <div className={styles.skeletonActions}>
                            <div />
                            <div />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function QueueItem({
    item,
    reviewingId,
    onReview
}: {
    item: CommunityQueueItem;
    reviewingId: string | null;
    onReview: (item: CommunityQueueItem, action: CommunityReviewAction) => void;
}) {
    const t = useTranslations();
    const locale = useLocale();
    const title = item.title || t('Xcity Studio video');
    const approving = reviewingId === `${item.id}:approve`;
    const rejecting = reviewingId === `${item.id}:reject`;

    return (
        <div className='grid gap-3 rounded-md border border-white/15 bg-white/[0.04] p-2 sm:grid-cols-[128px_1fr]'>
            <div className='aspect-square overflow-hidden rounded border border-white/15 bg-neutral-900'>
                <PreviewVideo url={item.video_url} title={title} />
            </div>
            <div className='min-w-0 space-y-2'>
                <div>
                    <div className='truncate text-sm font-medium text-white' title={title}>
                        {title}
                    </div>
                    <div className='mt-0.5 truncate text-[10px] text-white/35'>{item.owner}</div>
                </div>
                <p className='line-clamp-2 text-xs leading-5 text-white/55'>{item.prompt}</p>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <span className='text-[10px] text-white/35'>{formatDate(item.created_at, locale)}</span>
                    <div className='flex items-center gap-1.5'>
                        <Button
                            type='button'
                            size='sm'
                            disabled={Boolean(reviewingId)}
                            onClick={() => onReview(item, 'approve')}
                            className='h-7 bg-white px-2 text-xs text-black hover:bg-white/90'>
                            {approving ? <Loader2 className='h-3 w-3 animate-spin' /> : <Check className='h-3 w-3' />}
                            {t('Approve')}
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            disabled={Boolean(reviewingId)}
                            onClick={() => onReview(item, 'reject')}
                            className='h-7 bg-red-600/70 px-2 text-xs text-[var(--studio-status-foreground)] hover:bg-red-500/80'>
                            {rejecting ? <Loader2 className='h-3 w-3 animate-spin' /> : <X className='h-3 w-3' />}
                            {t('Reject')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CommunityPanel({ loadItems, loadQueue, reviewItem, onRecreate, active }: CommunityPanelProps) {
    const t = useTranslations();
    const loadFallback = t('Could not load community videos');
    const reviewFallback = t('Review failed');
    const [items, setItems] = React.useState<CommunityListItem[] | null>(null);
    const [queue, setQueue] = React.useState<CommunityQueueItem[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [reviewingId, setReviewingId] = React.useState<string | null>(null);
    const [visibleCount, setVisibleCount] = React.useState(COMMUNITY_BATCH_SIZE);
    const [isLoadingNextPage, setIsLoadingNextPage] = React.useState(false);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const loadingTimerRef = React.useRef<number | null>(null);

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const queuePromise = loadQueue().catch((err) => {
            console.warn('Could not load community review queue:', err);
            return null;
        });

        try {
            const [loadedItems, loadedQueue] = await Promise.all([loadItems(), queuePromise]);
            setItems(loadedItems);
            setQueue(loadedQueue);
        } catch (err) {
            setError(err instanceof Error ? err.message : loadFallback);
        } finally {
            setIsLoading(false);
        }
    }, [loadFallback, loadItems, loadQueue]);

    const fetchedRef = React.useRef(false);
    React.useEffect(() => {
        if (active && !fetchedRef.current) {
            fetchedRef.current = true;
            void refresh();
        }
    }, [active, refresh]);

    const handleReview = React.useCallback(
        async (item: CommunityQueueItem, action: CommunityReviewAction) => {
            setReviewingId(`${item.id}:${action}`);
            setError(null);
            try {
                await reviewItem(item.id, action);
                setQueue((prev) => prev?.filter((candidate) => candidate.id !== item.id) ?? prev);
                if (action === 'approve') {
                    setItems(await loadItems());
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : reviewFallback);
            } finally {
                setReviewingId(null);
            }
        },
        [loadItems, reviewFallback, reviewItem]
    );

    const approvedItems = items ?? [];
    const visibleItems = approvedItems.slice(0, visibleCount);
    const hasMoreItems = visibleCount < approvedItems.length;
    const loadingPlaceholderCount = isLoadingNextPage
        ? Math.min(COMMUNITY_BATCH_SIZE, approvedItems.length - visibleCount)
        : 0;

    React.useEffect(() => {
        setVisibleCount(Math.min(COMMUNITY_BATCH_SIZE, approvedItems.length));
        setIsLoadingNextPage(false);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
    }, [approvedItems.length]);

    const loadMoreItems = React.useCallback(() => {
        if (!hasMoreItems || isLoadingNextPage) return;
        setIsLoadingNextPage(true);
        if (loadingTimerRef.current) {
            window.clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
        loadingTimerRef.current = window.setTimeout(() => {
            setVisibleCount((current) => Math.min(current + COMMUNITY_BATCH_SIZE, approvedItems.length));
            setIsLoadingNextPage(false);
            loadingTimerRef.current = null;
        }, 180);
    }, [approvedItems.length, hasMoreItems, isLoadingNextPage]);

    const handleContentScroll = React.useCallback(
        (event: React.UIEvent<HTMLDivElement>) => {
            const target = event.currentTarget;
            const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (remaining <= 160) loadMoreItems();
        },
        [loadMoreItems]
    );

    React.useEffect(() => {
        if (!hasMoreItems) return;

        const handleWindowScroll = () => {
            const target = contentRef.current;
            if (!target || target.scrollHeight > target.clientHeight + 1) return;
            const remaining = target.getBoundingClientRect().bottom - window.innerHeight;
            if (remaining <= 160) loadMoreItems();
        };

        window.addEventListener('scroll', handleWindowScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleWindowScroll);
    }, [hasMoreItems, loadMoreItems]);

    React.useEffect(() => {
        return () => {
            if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        };
    }, []);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div>
                    <CardTitle className='text-lg font-medium text-white'>{t('Community')}</CardTitle>
                    <CardDescription className='mt-1 text-white/60'>
                        {t('Public videos approved for browsing')}
                    </CardDescription>
                </div>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => void refresh()}
                    disabled={isLoading}
                    className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />
                    <span className='ml-1'>{t('Refresh')}</span>
                </Button>
            </CardHeader>
            <CardContent ref={contentRef} onScroll={handleContentScroll} className='flex-grow overflow-y-auto p-4'>
                {error && <p className='mb-3 text-sm text-red-400'>{error}</p>}

                {queue !== null && (
                    <section className='mb-5 rounded-md border border-white/10 bg-white/[0.03] p-3'>
                        <div className='mb-3 flex items-center justify-between gap-3'>
                            <h3 className='text-sm font-medium text-white'>
                                {t('Review queue <lpar><lcur>count<rcur><rpar>', { count: queue.length })}
                            </h3>
                        </div>
                        {queue.length === 0 ? (
                            <p className='text-sm text-white/40'>{t('No submissions waiting for review')}</p>
                        ) : (
                            <div className='grid gap-3 lg:grid-cols-2'>
                                {queue.map((item) => (
                                    <QueueItem
                                        key={item.id}
                                        item={item}
                                        reviewingId={reviewingId}
                                        onReview={handleReview}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {isLoading && items === null ? (
                    <CommunityTileSkeleton count={COMMUNITY_BATCH_SIZE} />
                ) : (items ?? []).length === 0 ? (
                    <div className='flex h-40 items-center justify-center text-white/40'>
                        <p>{t('No approved community videos yet')}</p>
                    </div>
                ) : (
                    <>
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                        {visibleItems.map((item) => (
                            <CommunityTile key={item.id} item={item} onRecreate={onRecreate} />
                        ))}
                    </div>
                    {isLoadingNextPage && <CommunityTileSkeleton count={loadingPlaceholderCount} />}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
