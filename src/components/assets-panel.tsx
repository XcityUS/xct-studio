'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VideoCharacter, VideoPortrait } from '@/hooks/use-video-history';
import type { UserAsset } from '@/lib/media-archive';
import type { PortraitAsset, PortraitGroup, PortraitSession, PortraitStatus } from '@/lib/portrait';
import { Check, Copy, ImagePlus, Loader2, Music, RefreshCw, ShieldCheck, Trash2, UserPlus, Video } from 'lucide-react';
import * as React from 'react';

type AssetsPanelProps = {
    /** Fetches the caller's stored assets (uploads + archived videos). */
    loadAssets: () => Promise<UserAsset[]>;
    deleteAsset: (key: string) => Promise<void>;
    characters: VideoCharacter[];
    addCharacter: (character: VideoCharacter) => void;
    removeCharacter: (id: string) => void;
    portraitEnabled: boolean;
    portraits: VideoPortrait[];
    addPortrait: (portrait: VideoPortrait) => void;
    removePortrait: (assetId: string) => void;
    startPortraitSession: (origin: string) => Promise<PortraitSession>;
    loadPortraitGroups: () => Promise<PortraitGroup[]>;
    createPortraitAsset: (input: { groupId: string; url: string; name: string }) => Promise<{ assetId: string }>;
    getPortraitAsset: (assetId: string) => Promise<PortraitAsset>;
    /** Operator self-test of the real-human library configuration. */
    getPortraitStatus: () => Promise<PortraitStatus>;
    /** Loads an image asset into the video form's reference list. */
    onUseAsReference: (url: string) => void;
    /** Loads a video asset into the video form's reference video list. */
    onUseAsReferenceVideo: (url: string) => void;
    /** The panel fetches lazily — only once it has actually been shown. */
    active: boolean;
};

function formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function defaultCharacterName(asset: UserAsset): string {
    const assetName = asset.name?.trim();
    if (assetName) return assetName;
    const leaf = asset.key.split('/').pop() ?? '';
    return leaf
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim() || 'Character';
}

function shortAssetId(assetId: string): string {
    return assetId.length > 8 ? assetId.slice(-8) : assetId;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
 * uploaded reference media and R2-archived videos. Images and videos can be
 * pulled straight back into the creation form as references.
 */
export function AssetsPanel({
    loadAssets,
    deleteAsset,
    characters,
    addCharacter,
    removeCharacter,
    portraitEnabled,
    portraits,
    addPortrait,
    removePortrait,
    startPortraitSession,
    loadPortraitGroups,
    createPortraitAsset,
    getPortraitAsset,
    getPortraitStatus,
    onUseAsReference,
    onUseAsReferenceVideo,
    active
}: AssetsPanelProps) {
    const [assets, setAssets] = React.useState<UserAsset[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [kindFilter, setKindFilter] = React.useState<'all' | 'image' | 'audio' | 'video'>('all');
    const [characterAsset, setCharacterAsset] = React.useState<UserAsset | null>(null);
    const [characterName, setCharacterName] = React.useState('');
    const [portraitGroups, setPortraitGroups] = React.useState<PortraitGroup[] | null>(null);
    const [isLoadingPortraitGroups, setIsLoadingPortraitGroups] = React.useState(false);
    const [isStartingPortraitSession, setIsStartingPortraitSession] = React.useState(false);
    const [portraitError, setPortraitError] = React.useState<string | null>(null);
    const [portraitNotice, setPortraitNotice] = React.useState<string | null>(null);
    const [addingPortraitGroupId, setAddingPortraitGroupId] = React.useState<string | null>(null);
    const [portraitDrafts, setPortraitDrafts] = React.useState<Record<string, { assetKey: string; name: string }>>({});
    const [portraitStatus, setPortraitStatus] = React.useState<string | null>(null);
    const [isCheckingPortraitSetup, setIsCheckingPortraitSetup] = React.useState(false);

    const checkPortraitSetup = React.useCallback(async () => {
        setIsCheckingPortraitSetup(true);
        setPortraitStatus(null);
        try {
            const status = await getPortraitStatus();
            setPortraitStatus(
                status.ok
                    ? `Ready — BytePlus accepted the account keys (project "${status.projectName}").`
                    : `Not usable: ${status.error ?? 'unknown error'}`
            );
        } catch (err) {
            setPortraitStatus(err instanceof Error ? err.message : 'Setup check failed.');
        } finally {
            setIsCheckingPortraitSetup(false);
        }
    }, [getPortraitStatus]);

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

    const refreshPortraitGroups = React.useCallback(async () => {
        if (!portraitEnabled) return;
        setIsLoadingPortraitGroups(true);
        setPortraitError(null);
        try {
            setPortraitGroups(await loadPortraitGroups());
        } catch (err) {
            setPortraitError(err instanceof Error ? err.message : 'Could not load verified people.');
        } finally {
            setIsLoadingPortraitGroups(false);
        }
    }, [loadPortraitGroups, portraitEnabled]);

    // First fetch happens when the tab first becomes visible.
    const fetchedRef = React.useRef(false);
    React.useEffect(() => {
        if (active && !fetchedRef.current) {
            fetchedRef.current = true;
            void refresh();
        }
    }, [active, refresh]);

    const fetchedPortraitGroupsRef = React.useRef(false);
    React.useEffect(() => {
        if (active && portraitEnabled && !fetchedPortraitGroupsRef.current) {
            fetchedPortraitGroupsRef.current = true;
            void refreshPortraitGroups();
        }
    }, [active, portraitEnabled, refreshPortraitGroups]);

    const handleDelete = async (asset: UserAsset) => {
        if (!confirm(`Delete this ${asset.kind} from cloud storage? Links to it will stop working.`)) return;
        try {
            await deleteAsset(asset.key);
            setAssets((prev) => prev?.filter((a) => a.key !== asset.key) ?? prev);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed.');
        }
    };

    const openCharacterDialog = (asset: UserAsset) => {
        setCharacterAsset(asset);
        setCharacterName(defaultCharacterName(asset));
    };

    const handleCharacterDialogOpenChange = (open: boolean) => {
        if (open) return;
        setCharacterAsset(null);
        setCharacterName('');
    };

    const handleSaveCharacter = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!characterAsset) return;
        const name = characterName.trim();
        if (!name) return;
        addCharacter({ id: crypto.randomUUID(), name, url: characterAsset.url });
        handleCharacterDialogOpenChange(false);
    };

    const imageAssets = React.useMemo(() => (assets ?? []).filter((asset) => asset.kind === 'image'), [assets]);

    const updatePortraitDraft = React.useCallback(
        (groupId: string, patch: Partial<{ assetKey: string; name: string }>) => {
            setPortraitDrafts((prev) => ({
                ...prev,
                [groupId]: {
                    assetKey: prev[groupId]?.assetKey ?? '',
                    name: prev[groupId]?.name ?? '',
                    ...patch
                }
            }));
        },
        []
    );

    const handleStartPortraitSession = async () => {
        setIsStartingPortraitSession(true);
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const session = await startPortraitSession(window.location.origin);
            window.open(session.h5Link, '_blank', 'noopener,noreferrer');
            setPortraitNotice('Complete verification in the opened page, then return.');
        } catch (err) {
            setPortraitError(err instanceof Error ? err.message : 'Could not start verification.');
        } finally {
            setIsStartingPortraitSession(false);
        }
    };

    const waitForPortraitAsset = React.useCallback(
        async (assetId: string) => {
            const startedAt = Date.now();
            let lastStatus = '';
            while (Date.now() - startedAt <= 120_000) {
                const asset = await getPortraitAsset(assetId);
                lastStatus = asset.status;
                if (asset.status === 'Active') return;
                if (asset.status === 'Failed') {
                    throw new Error('BytePlus rejected this verified photo.');
                }
                await sleep(3000);
            }
            throw new Error(
                lastStatus
                    ? `Verified photo is still ${lastStatus.toLowerCase()}. Try again in a moment.`
                    : 'Verified photo processing timed out.'
            );
        },
        [getPortraitAsset]
    );

    const handleAddPortraitAsset = async (groupId: string) => {
        const draft = portraitDrafts[groupId];
        const selected = imageAssets.find((asset) => asset.key === draft?.assetKey);
        if (!selected) {
            setPortraitError('Choose an image asset first.');
            return;
        }

        const name = draft?.name.trim() || defaultCharacterName(selected);
        setAddingPortraitGroupId(groupId);
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const { assetId } = await createPortraitAsset({ groupId, url: selected.url, name });
            await waitForPortraitAsset(assetId);
            addPortrait({ assetId, groupId, name, thumbUrl: selected.url });
            setPortraitNotice('Verified photo added.');
            setPortraitDrafts((prev) => ({
                ...prev,
                [groupId]: { assetKey: '', name: '' }
            }));
        } catch (err) {
            setPortraitError(err instanceof Error ? err.message : 'Could not add verified photo.');
        } finally {
            setAddingPortraitGroupId(null);
        }
    };

    const visible = (assets ?? []).filter((a) => kindFilter === 'all' || a.kind === kindFilter);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <Dialog open={Boolean(characterAsset)} onOpenChange={handleCharacterDialogOpenChange}>
                <DialogContent className='border-white/20 bg-black text-white sm:max-w-[400px]'>
                    <form onSubmit={handleSaveCharacter} className='space-y-4'>
                        <DialogHeader>
                            <DialogTitle className='text-white'>Save as character</DialogTitle>
                            <DialogDescription className='text-white/60'>
                                Name this image for reuse in video prompts.
                            </DialogDescription>
                        </DialogHeader>
                        <div className='space-y-2'>
                            <Label htmlFor='character-name' className='text-white/80'>
                                Name
                            </Label>
                            <Input
                                id='character-name'
                                value={characterName}
                                onChange={(event) => setCharacterName(event.target.value)}
                                autoFocus
                                className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type='button'
                                variant='secondary'
                                onClick={() => handleCharacterDialogOpenChange(false)}
                                className='bg-white/10 text-white hover:bg-white/20'>
                                Cancel
                            </Button>
                            <Button
                                type='submit'
                                disabled={!characterName.trim()}
                                className='bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
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

                {!portraitEnabled && (
                    <div className='mb-4 space-y-2 border-b border-white/10 pb-4'>
                        <h3 className='text-xs font-medium text-white/50'>Verified people</h3>
                        <p className='text-xs text-white/40'>
                            BytePlus rejects reference images containing an identifiable real person. Verifying
                            people once (consent + face match) unlocks them — that library is not enabled on this
                            deployment yet. Ask the Xcity admin to enable it, or use reference images without a
                            recognizable person.
                        </p>
                        <button
                            type='button'
                            onClick={() => void checkPortraitSetup()}
                            disabled={isCheckingPortraitSetup}
                            className='text-xs text-white/40 underline transition-colors hover:text-white/70 disabled:opacity-50'>
                            {isCheckingPortraitSetup ? 'Checking…' : 'Check setup'}
                        </button>
                        {portraitStatus && <p className='text-xs text-white/50'>{portraitStatus}</p>}
                    </div>
                )}

                {portraitEnabled && (
                    <div className='mb-4 space-y-3 border-b border-white/10 pb-4'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='text-xs font-medium text-white/50'>Verified people</h3>
                            <div className='flex items-center gap-1.5'>
                                <button
                                    type='button'
                                    onClick={() => void checkPortraitSetup()}
                                    disabled={isCheckingPortraitSetup}
                                    className='rounded-md px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/70 disabled:opacity-50'>
                                    {isCheckingPortraitSetup ? 'Checking…' : 'Check setup'}
                                </button>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => void refreshPortraitGroups()}
                                    disabled={isLoadingPortraitGroups}
                                    className='h-auto rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white'>
                                    <RefreshCw
                                        size={13}
                                        className={isLoadingPortraitGroups ? 'animate-spin' : undefined}
                                    />
                                    <span className='ml-1'>Refresh</span>
                                </Button>
                                <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => void handleStartPortraitSession()}
                                    disabled={isStartingPortraitSession}
                                    className='h-auto bg-white px-2 py-1 text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                    {isStartingPortraitSession ? (
                                        <Loader2 className='h-3 w-3 animate-spin' />
                                    ) : (
                                        <ShieldCheck className='h-3 w-3' />
                                    )}
                                    Verify a real person
                                </Button>
                            </div>
                        </div>

                        {portraitNotice && <p className='text-xs text-emerald-300'>{portraitNotice}</p>}
                        {portraitStatus && <p className='text-xs text-white/50'>{portraitStatus}</p>}
                        {portraitError && <p className='text-xs text-red-400'>{portraitError}</p>}

                        {portraits.length > 0 && (
                            <div className='flex gap-2 overflow-x-auto pb-1'>
                                {portraits.map((portrait) => (
                                    <div
                                        key={portrait.assetId}
                                        className='flex shrink-0 items-center gap-2 rounded-md border border-emerald-400/25 bg-emerald-400/[0.06] px-2 py-1.5'>
                                        <div className='h-7 w-7 overflow-hidden rounded border border-white/15 bg-white/5'>
                                            {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL */}
                                            <img
                                                src={portrait.thumbUrl}
                                                alt={portrait.name}
                                                loading='lazy'
                                                className='h-full w-full object-cover'
                                            />
                                        </div>
                                        <div className='min-w-0'>
                                            <div className='max-w-32 truncate text-xs text-white/85'>
                                                {portrait.name}
                                            </div>
                                            <div className='flex items-center gap-1 text-[10px] text-emerald-300/80'>
                                                <ShieldCheck className='h-2.5 w-2.5' />
                                                Verified
                                            </div>
                                        </div>
                                        <button
                                            type='button'
                                            title='Remove verified photo'
                                            aria-label={`Remove verified photo ${portrait.name}`}
                                            onClick={() => removePortrait(portrait.assetId)}
                                            className='rounded p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white'>
                                            <Trash2 className='h-3 w-3' />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {isLoadingPortraitGroups && portraitGroups === null ? (
                            <div className='flex items-center gap-2 text-xs text-white/40'>
                                <Loader2 className='h-3 w-3 animate-spin' />
                                Loading verified groups…
                            </div>
                        ) : portraitGroups && portraitGroups.length > 0 ? (
                            <div className='space-y-2'>
                                {portraitGroups.map((group) => {
                                    const draft = portraitDrafts[group.id] ?? { assetKey: '', name: '' };
                                    const isAdding = addingPortraitGroupId === group.id;
                                    return (
                                        <div
                                            key={group.id}
                                            className='space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-2'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <div className='flex min-w-0 items-center gap-1.5 text-xs text-white/70'>
                                                    <ShieldCheck className='h-3.5 w-3.5 shrink-0 text-emerald-300' />
                                                    <span className='truncate'>Group {shortAssetId(group.id)}</span>
                                                </div>
                                                <span className='text-[10px] text-white/35'>{group.name}</span>
                                            </div>
                                            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]'>
                                                <select
                                                    aria-label='Image asset'
                                                    value={draft.assetKey}
                                                    onChange={(event) => {
                                                        const asset = imageAssets.find(
                                                            (candidate) => candidate.key === event.target.value
                                                        );
                                                        updatePortraitDraft(group.id, {
                                                            assetKey: event.target.value,
                                                            name: draft.name || (asset ? defaultCharacterName(asset) : '')
                                                        });
                                                    }}
                                                    disabled={isAdding || imageAssets.length === 0}
                                                    className='h-8 min-w-0 rounded-md border border-white/20 bg-black px-2 text-xs text-white disabled:opacity-40'>
                                                    <option value=''>Choose image asset</option>
                                                    {imageAssets.map((asset) => (
                                                        <option key={asset.key} value={asset.key}>
                                                            {asset.name || defaultCharacterName(asset)}
                                                        </option>
                                                    ))}
                                                </select>
                                                <Input
                                                    value={draft.name}
                                                    onChange={(event) =>
                                                        updatePortraitDraft(group.id, { name: event.target.value })
                                                    }
                                                    placeholder='Name'
                                                    disabled={isAdding}
                                                    className='h-8 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                />
                                                <Button
                                                    type='button'
                                                    size='sm'
                                                    onClick={() => void handleAddPortraitAsset(group.id)}
                                                    disabled={isAdding || !draft.assetKey}
                                                    className='h-8 bg-white text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                                    {isAdding ? (
                                                        <Loader2 className='h-3 w-3 animate-spin' />
                                                    ) : (
                                                        <ImagePlus className='h-3 w-3' />
                                                    )}
                                                    Add verified photo
                                                </Button>
                                            </div>
                                            {imageAssets.length === 0 && (
                                                <p className='text-[10px] text-white/35'>
                                                    Upload or save an image asset first.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className='text-xs text-white/40'>
                                No verified groups yet. Complete verification, then refresh.
                            </p>
                        )}
                    </div>
                )}

                {characters.length > 0 && (
                    <div className='mb-4 space-y-2'>
                        <h3 className='text-xs font-medium text-white/50'>Characters</h3>
                        <div className='flex gap-2 overflow-x-auto pb-1'>
                            {characters.map((character) => (
                                <div
                                    key={character.id}
                                    className='flex shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5'>
                                    <div className='h-7 w-7 overflow-hidden rounded border border-white/15 bg-white/5'>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL */}
                                        <img
                                            src={character.url}
                                            alt={character.name}
                                            loading='lazy'
                                            className='h-full w-full object-cover'
                                        />
                                    </div>
                                    <span className='max-w-32 truncate text-xs text-white/80'>{character.name}</span>
                                    <button
                                        type='button'
                                        title='Remove character'
                                        aria-label={`Remove character ${character.name}`}
                                        onClick={() => removeCharacter(character.id)}
                                        className='rounded p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white'>
                                        <Trash2 className='h-3 w-3' />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                                        <span>
                                            {asset.uploaded ? new Date(asset.uploaded).toLocaleDateString() : ''}
                                        </span>
                                        <span>{formatBytes(asset.bytes)}</span>
                                    </div>
                                    <div className='mt-1.5 flex flex-wrap items-center gap-1'>
                                        {asset.kind === 'image' && (
                                            <>
                                                <button
                                                    type='button'
                                                    title='Add to the video form as a reference image'
                                                    onClick={() => onUseAsReference(asset.url)}
                                                    className='flex min-w-[4rem] flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                    <ImagePlus size={11} />
                                                    Use as ref
                                                </button>
                                                <button
                                                    type='button'
                                                    title='Save this image as a named character'
                                                    onClick={() => openCharacterDialog(asset)}
                                                    className='flex min-w-[6.5rem] flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                    <UserPlus size={11} />
                                                    Save as character
                                                </button>
                                            </>
                                        )}
                                        {asset.kind === 'video' && (
                                            <button
                                                type='button'
                                                title='Add to the video form as a reference video'
                                                onClick={() => onUseAsReferenceVideo(asset.url)}
                                                className='flex min-w-[5rem] flex-1 items-center justify-center gap-1 rounded bg-white/10 px-1 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                <Video size={11} />
                                                Use as ref video
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
