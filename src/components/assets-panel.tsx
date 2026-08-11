'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserAsset } from '@/lib/media-archive';
import { Check, Copy, ImagePlus, Loader2, Music, RefreshCw, Trash2 } from 'lucide-react';
import * as React from 'react';

type AssetsPanelProps = {
    /** Fetches the caller's stored assets (uploads + archived videos). */
    loadAssets: () => Promise<UserAsset[]>;
    deleteAsset: (key: string) => Promise<void>;
    /** Loads an image asset into the video form's reference list. */
    onUseAsReference: (url: string) => void;
    /** The panel fetches lazily — only once it has actually been shown. */
    active: boolean;
};

function formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CopyUrlButton({ url }: { url: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <button
            type='button'
            title='Copy URL'
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                    console.error('Failed to copy URL:', err);
                }
            }}
            className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
            {copied ? <Check size={11} className='text-green-400' /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy URL'}
        </button>
    );
}

/**
 * Cloud assets stored by the media worker under the user's namespace:
 * uploaded reference media and R2-archived videos. Images can be pulled
 * straight back into the creation form as references.
 */
export function AssetsPanel({ loadAssets, deleteAsset, onUseAsReference, active }: AssetsPanelProps) {
    const [assets, setAssets] = React.useState<UserAsset[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [kindFilter, setKindFilter] = React.useState<'all' | 'image' | 'audio' | 'video'>('all');

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setAssets(await loadAssets());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load assets.');
        } finally {
            setIsLoading(false);
        }
    }, [loadAssets]);

    // First fetch happens when the tab first becomes visible.
    const fetchedRef = React.useRef(false);
    React.useEffect(() => {
        if (active && !fetchedRef.current) {
            fetchedRef.current = true;
            void refresh();
        }
    }, [active, refresh]);

    const handleDelete = async (asset: UserAsset) => {
        if (!confirm(`Delete this ${asset.kind} from cloud storage? Links to it will stop working.`)) return;
        try {
            await deleteAsset(asset.key);
            setAssets((prev) => prev?.filter((a) => a.key !== asset.key) ?? prev);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed.');
        }
    };

    const visible = (assets ?? []).filter((a) => kindFilter === 'all' || a.kind === kindFilter);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div>
                    <CardTitle className='text-lg font-medium text-white'>Assets</CardTitle>
                    <CardDescription className='mt-1 text-white/60'>
                        Uploaded reference media and cloud-archived videos
                    </CardDescription>
                </div>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => void refresh()}
                    disabled={isLoading}
                    className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : undefined} />
                    <span className='ml-1'>Refresh</span>
                </Button>
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {error && <p className='mb-3 text-sm text-red-400'>{error}</p>}

                <div className='mb-4 flex items-center gap-2'>
                    {(['all', 'image', 'audio', 'video'] as const).map((k) => (
                        <button
                            key={k}
                            type='button'
                            onClick={() => setKindFilter(k)}
                            className={
                                kindFilter === k
                                    ? 'rounded-full bg-white px-2.5 py-1 text-xs text-black'
                                    : 'rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60 transition-colors hover:bg-white/20 hover:text-white'
                            }>
                            {k === 'all' ? 'All' : k === 'image' ? 'Images' : k === 'audio' ? 'Audio' : 'Videos'}
                        </button>
                    ))}
                </div>

                {isLoading && assets === null ? (
                    <div className='flex h-40 items-center justify-center text-white/40'>
                        <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                        Loading assets…
                    </div>
                ) : visible.length === 0 ? (
                    <div className='flex h-40 items-center justify-center text-white/40'>
                        <p>
                            {assets && assets.length > 0
                                ? 'No assets match the current filter.'
                                : 'Nothing stored yet — uploaded reference media and archived videos will appear here.'}
                        </p>
                    </div>
                ) : (
                    <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
                        {visible.map((asset) => (
                            <div key={asset.key} className='flex flex-col' title={asset.key}>
                                <div className='relative aspect-square w-full overflow-hidden rounded-t-md border border-white/20 bg-neutral-900'>
                                    {asset.kind === 'image' ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL
                                        <img
                                            src={asset.url}
                                            alt={asset.key}
                                            loading='lazy'
                                            className='h-full w-full object-cover'
                                        />
                                    ) : asset.kind === 'audio' ? (
                                        <div className='flex h-full w-full flex-col items-center justify-center gap-3 p-3'>
                                            <Music className='h-8 w-8 text-white/35' />
                                            <audio src={asset.url} controls preload='none' className='w-full' />
                                        </div>
                                    ) : (
                                        <video
                                            src={`${asset.url}#t=0.001`}
                                            className='h-full w-full object-cover'
                                            muted
                                            preload='metadata'
                                            playsInline
                                            onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.pause();
                                                e.currentTarget.currentTime = 0;
                                            }}
                                        />
                                    )}
                                    <span className='pointer-events-none absolute top-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80'>
                                        {asset.kind}
                                    </span>
                                </div>
                                <div className='rounded-b-md border border-t-0 border-white/20 bg-neutral-900/50 p-2'>
                                    {asset.name && (
                                        <div className='mb-1 truncate text-xs text-white/80'>{asset.name}</div>
                                    )}
                                    <div className='flex items-center justify-between text-[10px] text-white/40'>
                                        <span>{asset.uploaded ? new Date(asset.uploaded).toLocaleDateString() : ''}</span>
                                        <span>{formatBytes(asset.bytes)}</span>
                                    </div>
                                    <div className='mt-1.5 flex items-center gap-1'>
                                        {asset.kind === 'image' && (
                                            <button
                                                type='button'
                                                title='Add to the video form as a reference image'
                                                onClick={() => onUseAsReference(asset.url)}
                                                className='flex flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                <ImagePlus size={11} />
                                                Use as ref
                                            </button>
                                        )}
                                        <CopyUrlButton url={asset.url} />
                                        <button
                                            type='button'
                                            title='Delete from cloud storage'
                                            onClick={() => void handleDelete(asset)}
                                            className='flex items-center justify-center rounded bg-red-600/60 p-1 text-white transition-colors hover:bg-red-500/80'>
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
