import type { ImageRecord } from '@/features/assets/storage/db';
import type { UserAsset } from '@/lib/media-archive';
import * as React from 'react';

export const CARD_GAP = 16;
const SCROLLBAR_GUTTER_WIDTH = 2;
const CARD_FOOTER_HEIGHT = 72;

function imageRecordFromAsset(asset: UserAsset): ImageRecord {
    return {
        id: `asset:${asset.key}`,
        prompt: asset.name ?? asset.key,
        model: 'Cloud asset',
        size: 'cloud',
        source_url: asset.url,
        created_at: asset.uploaded ? Date.parse(asset.uploaded) || 0 : 0
    };
}

function useImageObjectUrls(records: ImageRecord[] | undefined) {
    const urlsRef = React.useRef<Map<string, string>>(new Map());
    const [, setVersion] = React.useState(0);

    React.useEffect(() => {
        if (!records) return;
        const urls = urlsRef.current;
        const liveIds = new Set(records.map((record) => record.id));
        let changed = false;
        for (const [id, url] of urls) {
            if (!liveIds.has(id)) {
                URL.revokeObjectURL(url);
                urls.delete(id);
                changed = true;
            }
        }
        for (const record of records) {
            if (record.blob && !urls.has(record.id)) {
                urls.set(record.id, URL.createObjectURL(record.blob));
                changed = true;
            }
        }
        if (changed) {
            const frame = window.requestAnimationFrame(() => setVersion((version) => version + 1));
            return () => window.cancelAnimationFrame(frame);
        }
    }, [records]);

    React.useEffect(() => {
        const urls = urlsRef.current;
        return () => {
            for (const [, url] of urls) URL.revokeObjectURL(url);
            urls.clear();
        };
    }, []);

    return React.useCallback(
        (record: ImageRecord): string | undefined => urlsRef.current.get(record.id) ?? record.source_url,
        []
    );
}

export function useImageGallery(
    records: ImageRecord[] | undefined,
    cloudImageAssets: UserAsset[],
    pendingGenerationCount: number,
    generatingLabel: string
) {
    const listContainerRef = React.useRef<HTMLDivElement>(null);
    const [listWidth, setListWidth] = React.useState(0);
    const [containerHeight, setContainerHeight] = React.useState(0);
    const [scrollTop, setScrollTop] = React.useState(0);
    const [columns, setColumns] = React.useState(2);
    const getSrc = useImageObjectUrls(records);
    const visibleRecords = React.useMemo(() => {
        const localRecords = records ?? [];
        const localUrls = new Set(localRecords.map((record) => record.source_url).filter(Boolean));
        const cloudRecords = cloudImageAssets
            .filter((asset) => asset.kind === 'image' && asset.url && !localUrls.has(asset.url))
            .map(imageRecordFromAsset);
        return [...localRecords, ...cloudRecords];
    }, [cloudImageAssets, records]);
    const allItems = React.useMemo(() => {
        const pendingItems = Array.from({ length: pendingGenerationCount }).map((_, index) => ({
            kind: 'pending' as const,
            id: `pending-image-${index}`,
            prompt: generatingLabel
        }));
        const recordItems = visibleRecords.map((record) => ({ kind: 'record' as const, record }));
        return [...pendingItems, ...recordItems];
    }, [pendingGenerationCount, visibleRecords, generatingLabel]);
    const itemWidth = React.useMemo(
        () => (!listWidth || columns <= 0 ? 0 : (listWidth - CARD_GAP * (columns - 1)) / columns),
        [columns, listWidth]
    );
    const rowHeight = React.useMemo(() => (itemWidth ? itemWidth + CARD_FOOTER_HEIGHT + CARD_GAP : 0), [itemWidth]);

    React.useEffect(() => {
        const root = listContainerRef.current;
        if (!root) return;
        const onScroll = () => setScrollTop(root.scrollTop);
        const measure = () => {
            const width = root.clientWidth - SCROLLBAR_GUTTER_WIDTH;
            setColumns(width >= 1024 ? 4 : width >= 768 ? 3 : width >= 640 ? 3 : 2);
            setListWidth(width);
            setContainerHeight(root.clientHeight);
        };
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(root);
        root.addEventListener('scroll', onScroll);
        measure();
        return () => {
            root.removeEventListener('scroll', onScroll);
            resizeObserver.disconnect();
        };
    }, []);

    const totalRows = allItems.length && columns > 0 ? Math.ceil(allItems.length / columns) : 0;
    const visibleRange = React.useMemo(() => {
        if (!rowHeight || !allItems.length) return { start: 0, end: 0 };
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight));
        const visibleRows = containerHeight > 0 ? Math.ceil(containerHeight / rowHeight) : 8;
        return {
            start: Math.max(0, startRow - 2) * columns,
            end: Math.min(allItems.length, (startRow + visibleRows + 2) * columns)
        };
    }, [allItems.length, columns, containerHeight, rowHeight, scrollTop]);
    return {
        listContainerRef,
        columns,
        getSrc,
        allItems,
        itemWidth,
        rowHeight,
        visibleRange,
        totalHeight: totalRows * rowHeight
    };
}
