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
import type {
    AuthorizationItem,
    AuthorizationQueueItem,
    AuthorizationReviewAction,
    CreatedAuthorization
} from '@/lib/authorization';
import { validateAssetImage } from '@/lib/image-constraints';
import type { UserAsset } from '@/lib/media-archive';
import {
    waitForPortraitAsset,
    type PortraitAsset,
    type PortraitGroup,
    type PortraitGroupQueryType,
    type PortraitGroupType,
    type PortraitSession,
    type PortraitStatus
} from '@/lib/portrait';
import { refKey } from '@/lib/reference-origin';
import {
    Check,
    ChevronDown,
    Copy,
    FileText,
    ImagePlus,
    Loader2,
    Music,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Trash2,
    UserPlus,
    Video,
    X
} from 'lucide-react';
import * as React from 'react';

type AssetsPanelProps = {
    /** Fetches the caller's stored assets (uploads + archived videos). */
    loadAssets: () => Promise<UserAsset[]>;
    deleteAsset: (key: string) => Promise<void>;
    loadAuthorizations: () => Promise<AuthorizationItem[]>;
    submitAuthorization: (input: {
        subjectName: string;
        referenceKey: string;
        note: string;
        file: File;
    }) => Promise<CreatedAuthorization>;
    loadAuthorizationQueue: () => Promise<AuthorizationQueueItem[] | null>;
    reviewAuthorization: (id: string, action: AuthorizationReviewAction, note: string) => Promise<void>;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
    authorizationTargets: { key: string; label: string; url: string; kind?: 'image' | 'video'; authorizationId?: string }[];
    selectedAuthorizationReferenceKey: string | null;
    onAuthorizationSubmitted: (referenceKey: string, authorizationId: string) => void;
    characters: VideoCharacter[];
    addCharacter: (character: VideoCharacter) => void;
    removeCharacter: (id: string) => void;
    portraitEnabled: boolean;
    portraits: VideoPortrait[];
    addPortrait: (portrait: VideoPortrait) => void;
    removePortrait: (assetId: string) => void;
    startPortraitSession: (origin: string) => Promise<PortraitSession>;
    loadPortraitGroups: (type?: PortraitGroupQueryType) => Promise<PortraitGroup[]>;
    createPortraitGroup: (name: string) => Promise<{ groupId: string; slug: string; created: boolean }>;
    createPortraitAsset: (input: {
        groupId: string;
        url: string;
        name: string;
        assetType?: 'Image' | 'Video' | 'Audio';
    }) => Promise<{ assetId: string }>;
    getPortraitAsset: (assetId: string) => Promise<PortraitAsset>;
    /** Operator self-test of the real-human library configuration. */
    getPortraitStatus: () => Promise<PortraitStatus>;
    /** Loads an image asset into the video form's reference list. */
    onUseAsReference: (url: string) => void;
    /** Loads a video asset into the video form's reference video list. */
    onUseAsReferenceVideo: (url: string) => void;
    /** Sends the user back to the video form to mark a reference for licensing review. */
    onMarkReferenceForAuthorization?: () => void;
    /** The panel fetches lazily — only once it has actually been shown. */
    active: boolean;
};

type AuthorizationTargetOption = {
    key: string;
    label: string;
    url: string;
    kind?: 'image' | 'video';
    authorizationId?: string;
};

function formatBytes(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function authorizationStatusClass(status: AuthorizationItem['status']): string {
    if (status === 'approved') return 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200';
    if (status === 'rejected') return 'border-red-400/30 bg-red-400/[0.08] text-red-200';
    return 'border-amber-300/30 bg-amber-300/[0.08] text-amber-100';
}

function AuthorizationStatusBadge({ status }: { status: AuthorizationItem['status'] }) {
    return (
        <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${authorizationStatusClass(
                status
            )}`}>
            {status}
        </span>
    );
}

function shortReferenceKey(value: string): string {
    return value.length > 14 ? `${value.slice(0, 7)}...${value.slice(-6)}` : value;
}

function defaultCharacterName(asset: UserAsset): string {
    const assetName = asset.name?.trim();
    if (assetName) return assetName;
    const leaf = asset.key.split('/').pop() ?? '';
    return (
        leaf
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .trim() || 'Character'
    );
}

function readableAssetStem(asset: UserAsset): string {
    const raw = asset.name?.trim() || asset.key.split('/').pop()?.trim() || '';
    const stem = raw
        .replace(/\.[^.]+$/, '')
        .replace(/^(video|image|audio)[-_]/i, '')
        .trim();
    if (!stem || /^[A-Za-z0-9_-]{28,}$/.test(stem)) return '';
    return stem.length > 24 ? `${stem.slice(0, 12)}...${stem.slice(-8)}` : stem;
}

function authorizationAssetLabel(asset: UserAsset, index: number): string {
    const kindLabel = asset.kind === 'video' ? 'Video' : 'Image';
    const details = [readableAssetStem(asset), formatBytes(asset.bytes), formatDate(asset.uploaded ?? '')].filter(Boolean);
    return [`${kindLabel} asset ${index + 1}`, ...details].join(' · ');
}

function isUploadedReferenceMedia(asset: UserAsset): boolean {
    return /\/(?:refs|videos)\//.test(asset.key) && (asset.kind === 'image' || asset.kind === 'video');
}

function shortAssetId(assetId: string): string {
    return assetId.length > 8 ? assetId.slice(-8) : assetId;
}

function portraitGroupLabel(group: PortraitGroup): string {
    const slug = group.name.split(':').slice(2).join(':').trim();
    return slug || `Group ${shortAssetId(group.id)}`;
}

function CopyUrlButton({ url }: { url: string }) {
    const [copied, setCopied] = React.useState(false);
    const [copyFailed, setCopyFailed] = React.useState(false);
    return (
        <button
            type='button'
            title='Copy URL'
            onClick={async () => {
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(url);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = url;
                        textarea.setAttribute('readonly', '');
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        const ok = document.execCommand('copy');
                        document.body.removeChild(textarea);
                        if (!ok) throw new Error('Copy command was rejected.');
                    }
                    setCopied(true);
                    setCopyFailed(false);
                    setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                    console.error('Failed to copy URL:', err);
                    setCopied(false);
                    setCopyFailed(true);
                    setTimeout(() => setCopyFailed(false), 2500);
                }
            }}
            className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
            {copied ? <Check size={11} className='text-green-400' /> : <Copy size={11} />}
            {copyFailed ? 'Copy failed' : copied ? 'Copied' : 'Copy URL'}
        </button>
    );
}

function AuthorizationDocButton({
    item,
    fetchAuthorizationDoc
}: {
    item: Pick<AuthorizationItem, 'id' | 'has_doc' | 'doc_bytes' | 'doc_content_type'>;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
}) {
    const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
    const [isLoadingDoc, setIsLoadingDoc] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [objectUrl]);

    const openDoc = async () => {
        if (!item.has_doc || isLoadingDoc) return;
        setError(null);
        if (objectUrl) {
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        setIsLoadingDoc(true);
        try {
            const blob = await fetchAuthorizationDoc(item.id);
            const url = URL.createObjectURL(blob);
            setObjectUrl(url);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not open document.');
        } finally {
            setIsLoadingDoc(false);
        }
    };

    return (
        <div className='space-y-1'>
            <button
                type='button'
                onClick={() => void openDoc()}
                disabled={!item.has_doc || isLoadingDoc}
                className='inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2.5 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                {isLoadingDoc ? <Loader2 className='h-3 w-3 animate-spin' /> : <FileText className='h-3 w-3' />}
                {item.has_doc ? 'Open doc' : 'No doc'}
            </button>
            {item.has_doc && (
                <p className='text-[10px] text-white/35'>
                    {item.doc_content_type || 'document'} {formatBytes(item.doc_bytes)}
                </p>
            )}
            {error && <p className='text-[10px] text-red-300'>{error}</p>}
        </div>
    );
}

function AuthorizationListItem({
    item,
    fetchAuthorizationDoc
}: {
    item: AuthorizationItem;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
}) {
    const submittedAt = formatDate(item.created_at) || '-';
    const reviewedAt = item.reviewed_at ? formatDate(item.reviewed_at) : '';

    return (
        <div className='flex min-h-44 flex-col rounded-md border border-white/10 bg-black/35 p-3'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 space-y-1'>
                    <div className='truncate text-sm font-medium text-white' title={item.subject_name}>
                        {item.subject_name || 'Untitled subject'}
                    </div>
                    <div
                        className='inline-flex max-w-full rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/40'
                        title={item.reference_key}>
                        <span className='truncate'>{shortReferenceKey(item.reference_key)}</span>
                    </div>
                </div>
                <AuthorizationStatusBadge status={item.status} />
            </div>
            <p
                className={`mt-3 min-h-14 rounded-md px-2 py-1.5 text-xs leading-5 ${
                    item.note ? 'bg-white/[0.04] text-white/55' : 'border border-dashed border-white/10 text-white/25'
                }`}>
                <span className='line-clamp-2'>{item.note || 'No note'}</span>
            </p>
            <div className='mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-3'>
                <div className='space-y-0.5 text-[10px] text-white/35'>
                    <div>Submitted {submittedAt}</div>
                    <div className={reviewedAt ? undefined : 'text-transparent'}>Reviewed {reviewedAt || '-'}</div>
                </div>
                <AuthorizationDocButton item={item} fetchAuthorizationDoc={fetchAuthorizationDoc} />
            </div>
            {item.review_note && (
                <p className='rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-white/50'>
                    Review note: {item.review_note}
                </p>
            )}
        </div>
    );
}

function AuthorizationQueueCard({
    item,
    reviewingId,
    reviewNote,
    onReviewNoteChange,
    onReview,
    fetchAuthorizationDoc
}: {
    item: AuthorizationQueueItem;
    reviewingId: string | null;
    reviewNote: string;
    onReviewNoteChange: (id: string, note: string) => void;
    onReview: (item: AuthorizationQueueItem, action: AuthorizationReviewAction) => void;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
}) {
    const approving = reviewingId === `${item.id}:approve`;
    const rejecting = reviewingId === `${item.id}:reject`;

    return (
        <div className='space-y-3 rounded-md border border-white/15 bg-white/[0.04] p-3'>
            <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='truncate text-sm font-medium text-white' title={item.subject_name}>
                        {item.subject_name}
                    </div>
                    <div className='mt-0.5 truncate text-[10px] text-white/35'>{item.owner}</div>
                </div>
                <span className='shrink-0 text-[10px] text-white/35'>{formatDate(item.created_at)}</span>
            </div>
            <div className='font-mono text-[10px] text-white/35' title={item.reference_key}>
                {shortReferenceKey(item.reference_key)}
            </div>
            {item.note && <p className='line-clamp-3 text-xs leading-5 text-white/55'>{item.note}</p>}
            <AuthorizationDocButton item={item} fetchAuthorizationDoc={fetchAuthorizationDoc} />
            <Input
                value={reviewNote}
                onChange={(event) => onReviewNoteChange(item.id, event.target.value)}
                placeholder='Review note'
                disabled={Boolean(reviewingId)}
                className='h-8 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
            />
            <div className='flex items-center justify-end gap-1.5'>
                <Button
                    type='button'
                    size='sm'
                    disabled={Boolean(reviewingId)}
                    onClick={() => onReview(item, 'approve')}
                    className='h-7 bg-white px-2 text-xs text-black hover:bg-white/90'>
                    {approving ? <Loader2 className='h-3 w-3 animate-spin' /> : <Check className='h-3 w-3' />}
                    Approve
                </Button>
                <Button
                    type='button'
                    size='sm'
                    disabled={Boolean(reviewingId)}
                    onClick={() => onReview(item, 'reject')}
                    className='h-7 bg-red-600/70 px-2 text-xs text-white hover:bg-red-500/80'>
                    {rejecting ? <Loader2 className='h-3 w-3 animate-spin' /> : <X className='h-3 w-3' />}
                    Reject
                </Button>
            </div>
        </div>
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
    loadAuthorizations,
    submitAuthorization,
    loadAuthorizationQueue,
    reviewAuthorization,
    fetchAuthorizationDoc,
    authorizationTargets,
    selectedAuthorizationReferenceKey,
    onAuthorizationSubmitted,
    characters,
    addCharacter,
    removeCharacter,
    portraitEnabled,
    portraits,
    addPortrait,
    removePortrait,
    startPortraitSession,
    loadPortraitGroups,
    createPortraitGroup,
    createPortraitAsset,
    getPortraitAsset,
    getPortraitStatus,
    onUseAsReference,
    onUseAsReferenceVideo,
    onMarkReferenceForAuthorization,
    active
}: AssetsPanelProps) {
    const [assets, setAssets] = React.useState<UserAsset[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [kindFilter, setKindFilter] = React.useState<'all' | 'image' | 'audio' | 'video'>('all');
    const [authorizations, setAuthorizations] = React.useState<AuthorizationItem[] | null>(null);
    const [authorizationQueue, setAuthorizationQueue] = React.useState<AuthorizationQueueItem[] | null>(null);
    const [isLoadingAuthorizations, setIsLoadingAuthorizations] = React.useState(false);
    const [authorizationError, setAuthorizationError] = React.useState<string | null>(null);
    const [authorizationNotice, setAuthorizationNotice] = React.useState<string | null>(null);
    const [authorizationReferenceKey, setAuthorizationReferenceKey] = React.useState('');
    const [authorizationSubjectName, setAuthorizationSubjectName] = React.useState('');
    const [authorizationNote, setAuthorizationNote] = React.useState('');
    const [authorizationFile, setAuthorizationFile] = React.useState<File | null>(null);
    const [isSubmittingAuthorization, setIsSubmittingAuthorization] = React.useState(false);
    const [reviewingAuthorizationId, setReviewingAuthorizationId] = React.useState<string | null>(null);
    const [authorizationReviewNotes, setAuthorizationReviewNotes] = React.useState<Record<string, string>>({});
    const authorizationFileInputRef = React.useRef<HTMLInputElement>(null);
    const [characterAsset, setCharacterAsset] = React.useState<UserAsset | null>(null);
    const [characterName, setCharacterName] = React.useState('');
    const [portraitGroups, setPortraitGroups] = React.useState<PortraitGroup[] | null>(null);
    const [isLoadingPortraitGroups, setIsLoadingPortraitGroups] = React.useState(false);
    const [isStartingPortraitSession, setIsStartingPortraitSession] = React.useState(false);
    const [isCreatingVirtualGroup, setIsCreatingVirtualGroup] = React.useState(false);
    const [virtualCharacterName, setVirtualCharacterName] = React.useState('');
    const [portraitError, setPortraitError] = React.useState<string | null>(null);
    const [portraitNotice, setPortraitNotice] = React.useState<string | null>(null);
    const [addingPortraitGroupId, setAddingPortraitGroupId] = React.useState<string | null>(null);
    const [portraitDrafts, setPortraitDrafts] = React.useState<Record<string, { assetKey: string; name: string }>>({});
    const [portraitStatus, setPortraitStatus] = React.useState<string | null>(null);
    const [isCheckingPortraitSetup, setIsCheckingPortraitSetup] = React.useState(false);
    const uploadedAuthorizationTargets = React.useMemo<AuthorizationTargetOption[]>(
        () =>
            (assets ?? [])
                .filter(isUploadedReferenceMedia)
                .map((asset, index) => {
                    const kind: 'image' | 'video' = asset.kind === 'video' ? 'video' : 'image';
                    return {
                        key: refKey(asset.url),
                        label: authorizationAssetLabel({ ...asset, kind }, index),
                        url: asset.url,
                        kind
                    };
                })
                .filter((target) => target.key),
        [assets]
    );
    const authorizationTargetOptions = React.useMemo<AuthorizationTargetOption[]>(() => {
        const seen = new Set<string>();
        return [...authorizationTargets, ...uploadedAuthorizationTargets].filter((target) => {
            if (seen.has(target.key)) return false;
            seen.add(target.key);
            return true;
        });
    }, [authorizationTargets, uploadedAuthorizationTargets]);

    const checkPortraitSetup = React.useCallback(async () => {
        setIsCheckingPortraitSetup(true);
        setPortraitStatus(null);
        try {
            const status = await getPortraitStatus();
            setPortraitStatus(
                status.ok
                    ? `Ready — BytePlus accepted both portrait libraries (project "${status.projectName}").`
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

    const refreshAuthorizations = React.useCallback(async () => {
        setIsLoadingAuthorizations(true);
        setAuthorizationError(null);
        const queuePromise = loadAuthorizationQueue().catch((err) => {
            console.warn('Could not load authorization review queue:', err);
            return null;
        });

        try {
            const [loadedItems, loadedQueue] = await Promise.all([loadAuthorizations(), queuePromise]);
            setAuthorizations(loadedItems);
            setAuthorizationQueue(loadedQueue);
        } catch (err) {
            setAuthorizationError(err instanceof Error ? err.message : 'Could not load authorizations.');
        } finally {
            setIsLoadingAuthorizations(false);
        }
    }, [loadAuthorizationQueue, loadAuthorizations]);

    const refreshPortraitGroups = React.useCallback(async () => {
        if (!portraitEnabled) return;
        setIsLoadingPortraitGroups(true);
        setPortraitError(null);
        try {
            setPortraitGroups(await loadPortraitGroups('all'));
        } catch (err) {
            setPortraitError(err instanceof Error ? err.message : 'Could not load portrait groups.');
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
            void refreshAuthorizations();
        }
    }, [active, refresh, refreshAuthorizations]);

    React.useEffect(() => {
        if (
            selectedAuthorizationReferenceKey &&
            authorizationTargetOptions.some((target) => target.key === selectedAuthorizationReferenceKey)
        ) {
            setAuthorizationReferenceKey(selectedAuthorizationReferenceKey);
            return;
        }
        setAuthorizationReferenceKey((current) =>
            current && authorizationTargetOptions.some((target) => target.key === current)
                ? current
                : (authorizationTargetOptions[0]?.key ?? '')
        );
    }, [authorizationTargetOptions, selectedAuthorizationReferenceKey]);

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
    const livenessGroups = React.useMemo(
        () => (portraitGroups ?? []).filter((group) => group.groupType === 'LivenessFace'),
        [portraitGroups]
    );
    const virtualGroups = React.useMemo(
        () => (portraitGroups ?? []).filter((group) => group.groupType === 'AIGC'),
        [portraitGroups]
    );
    const verifiedPortraits = React.useMemo(
        () => portraits.filter((portrait) => portrait.groupType === 'LivenessFace'),
        [portraits]
    );
    const virtualPortraits = React.useMemo(
        () => portraits.filter((portrait) => portrait.groupType === 'AIGC'),
        [portraits]
    );

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

    const handleCreateVirtualGroup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = virtualCharacterName.trim();
        if (!name) return;

        setIsCreatingVirtualGroup(true);
        setPortraitError(null);
        setPortraitNotice(null);
        try {
            const result = await createPortraitGroup(name);
            setVirtualCharacterName('');
            setPortraitNotice(
                result.created
                    ? `Virtual character "${result.slug}" created.`
                    : `Using existing virtual character "${result.slug}".`
            );
            await refreshPortraitGroups();
        } catch (err) {
            setPortraitError(err instanceof Error ? err.message : 'Could not create virtual character.');
        } finally {
            setIsCreatingVirtualGroup(false);
        }
    };

    const handleAddPortraitAsset = async (groupId: string, groupType: PortraitGroupType) => {
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
            const validation = await validateAssetImage(selected.url);
            if (validation.status === 'rejected') {
                throw new Error(validation.message);
            }
            if (validation.status === 'unknown') {
                setPortraitNotice(validation.message);
            }

            const { assetId } = await createPortraitAsset({ groupId, url: selected.url, name, assetType: 'Image' });
            await waitForPortraitAsset(assetId, getPortraitAsset);
            addPortrait({ assetId, groupId, groupType, name, thumbUrl: selected.url });
            setPortraitNotice(groupType === 'AIGC' ? 'Virtual character image added.' : 'Verified photo added.');
            setPortraitDrafts((prev) => ({
                ...prev,
                [groupId]: { assetKey: '', name: '' }
            }));
        } catch (err) {
            setPortraitNotice(null);
            setPortraitError(err instanceof Error ? err.message : 'Could not add portrait image.');
        } finally {
            setAddingPortraitGroupId(null);
        }
    };

    const handleSubmitAuthorization = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const referenceKey = authorizationReferenceKey.trim();
        const subjectName = authorizationSubjectName.trim();
        const note = authorizationNote.trim();
        if (!referenceKey) {
            setAuthorizationError('Choose a licensed reference image first.');
            return;
        }
        if (!subjectName) {
            setAuthorizationError('Enter the celebrity or character name.');
            return;
        }
        if (!authorizationFile) {
            setAuthorizationError('Choose a PDF, PNG, JPEG, or WebP authorization document.');
            return;
        }

        setIsSubmittingAuthorization(true);
        setAuthorizationError(null);
        setAuthorizationNotice(null);
        try {
            const created = await submitAuthorization({
                subjectName,
                referenceKey,
                note,
                file: authorizationFile
            });
            onAuthorizationSubmitted(referenceKey, created.id);
            setAuthorizationSubjectName('');
            setAuthorizationNote('');
            setAuthorizationFile(null);
            if (authorizationFileInputRef.current) authorizationFileInputRef.current.value = '';
            setAuthorizationNotice(
                'Authorization submitted for review. Approval only unblocks this studio check; BytePlus may still refuse the image during moderation.'
            );
            await refreshAuthorizations();
        } catch (err) {
            setAuthorizationError(err instanceof Error ? err.message : 'Authorization submission failed.');
        } finally {
            setIsSubmittingAuthorization(false);
        }
    };

    const handleReviewAuthorization = React.useCallback(
        async (item: AuthorizationQueueItem, action: AuthorizationReviewAction) => {
            setReviewingAuthorizationId(`${item.id}:${action}`);
            setAuthorizationError(null);
            try {
                await reviewAuthorization(item.id, action, authorizationReviewNotes[item.id]?.trim() ?? '');
                setAuthorizationQueue((prev) => prev?.filter((candidate) => candidate.id !== item.id) ?? prev);
                setAuthorizations(await loadAuthorizations());
            } catch (err) {
                setAuthorizationError(err instanceof Error ? err.message : 'Authorization review failed.');
            } finally {
                setReviewingAuthorizationId(null);
            }
        },
        [authorizationReviewNotes, loadAuthorizations, reviewAuthorization]
    );

    const visible = (assets ?? []).filter((a) => kindFilter === 'all' || a.kind === kindFilter);
    const selectedAuthorizationTarget = authorizationTargetOptions.find(
        (target) => target.key === authorizationReferenceKey
    );

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
                    onClick={() => {
                        void refresh();
                        void refreshAuthorizations();
                    }}
                    disabled={isLoading || isLoadingAuthorizations}
                    className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                    <RefreshCw
                        size={14}
                        className={isLoading || isLoadingAuthorizations ? 'animate-spin' : undefined}
                    />
                    <span className='ml-1'>Refresh</span>
                </Button>
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {error && <p className='mb-3 text-sm text-red-400'>{error}</p>}

                {!portraitEnabled && (
                    <div className='mb-4 space-y-2 border-b border-white/10 pb-4'>
                        <h3 className='text-xs font-medium text-white/50'>Verified people</h3>
                        <p className='text-xs text-white/40'>
                            BytePlus rejects reference images containing an identifiable real person. Verifying people
                            once (consent + face match) unlocks them — that library is not enabled on this deployment
                            yet. Ask the Xcity admin to enable it, or use reference images without a recognizable
                            person.
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

                        {verifiedPortraits.length > 0 && (
                            <div className='flex gap-2 overflow-x-auto pb-1'>
                                {verifiedPortraits.map((portrait) => (
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
                        ) : portraitGroups && livenessGroups.length > 0 ? (
                            <div className='space-y-2'>
                                {livenessGroups.map((group) => {
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
                                                            name:
                                                                draft.name || (asset ? defaultCharacterName(asset) : '')
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
                                                    onClick={() =>
                                                        void handleAddPortraitAsset(group.id, 'LivenessFace')
                                                    }
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

                        <div className='space-y-3 border-t border-white/10 pt-4'>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div className='min-w-0 flex-1'>
                                    <h3 className='text-xs font-medium text-white/50'>Virtual characters</h3>
                                    <p className='mt-1 text-xs text-white/40'>
                                        Put multiple images of the same character in one group to keep that character
                                        consistent across shots.
                                    </p>
                                </div>
                                <form
                                    onSubmit={(event) => void handleCreateVirtualGroup(event)}
                                    className='flex min-w-0 flex-1 gap-2 sm:max-w-sm'>
                                    <Input
                                        value={virtualCharacterName}
                                        onChange={(event) => setVirtualCharacterName(event.target.value)}
                                        placeholder='Character name'
                                        disabled={isCreatingVirtualGroup}
                                        className='h-8 min-w-0 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                    />
                                    <Button
                                        type='submit'
                                        size='sm'
                                        disabled={isCreatingVirtualGroup || !virtualCharacterName.trim()}
                                        className='h-8 shrink-0 bg-white text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                        {isCreatingVirtualGroup ? (
                                            <Loader2 className='h-3 w-3 animate-spin' />
                                        ) : (
                                            <Sparkles className='h-3 w-3' />
                                        )}
                                        Create
                                    </Button>
                                </form>
                            </div>

                            {virtualPortraits.length > 0 && (
                                <div className='flex gap-2 overflow-x-auto pb-1'>
                                    {virtualPortraits.map((portrait) => (
                                        <div
                                            key={portrait.assetId}
                                            className='flex shrink-0 items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] px-2 py-1.5'>
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
                                                <div className='flex items-center gap-1 text-[10px] text-cyan-200/80'>
                                                    <Sparkles className='h-2.5 w-2.5' />
                                                    Virtual
                                                </div>
                                            </div>
                                            <button
                                                type='button'
                                                title='Remove virtual character image'
                                                aria-label={`Remove virtual character image ${portrait.name}`}
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
                                    Loading virtual characters…
                                </div>
                            ) : portraitGroups && virtualGroups.length > 0 ? (
                                <div className='space-y-2'>
                                    {virtualGroups.map((group) => {
                                        const draft = portraitDrafts[group.id] ?? { assetKey: '', name: '' };
                                        const isAdding = addingPortraitGroupId === group.id;
                                        return (
                                            <div
                                                key={group.id}
                                                className='space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-2'>
                                                <div className='flex items-center justify-between gap-2'>
                                                    <div className='flex min-w-0 items-center gap-1.5 text-xs text-white/70'>
                                                        <Sparkles className='h-3.5 w-3.5 shrink-0 text-cyan-200' />
                                                        <span className='truncate'>{portraitGroupLabel(group)}</span>
                                                    </div>
                                                    <span className='text-[10px] text-white/35'>
                                                        Group {shortAssetId(group.id)}
                                                    </span>
                                                </div>
                                                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]'>
                                                    <select
                                                        aria-label='Virtual character image asset'
                                                        value={draft.assetKey}
                                                        onChange={(event) => {
                                                            const asset = imageAssets.find(
                                                                (candidate) => candidate.key === event.target.value
                                                            );
                                                            updatePortraitDraft(group.id, {
                                                                assetKey: event.target.value,
                                                                name:
                                                                    draft.name ||
                                                                    (asset ? defaultCharacterName(asset) : '')
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
                                                        onClick={() => void handleAddPortraitAsset(group.id, 'AIGC')}
                                                        disabled={isAdding || !draft.assetKey}
                                                        className='h-8 bg-white text-xs text-black hover:bg-white/90 disabled:bg-white/40'>
                                                        {isAdding ? (
                                                            <Loader2 className='h-3 w-3 animate-spin' />
                                                        ) : (
                                                            <ImagePlus className='h-3 w-3' />
                                                        )}
                                                        Add character image
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
                                    No virtual characters yet. Create one, then add uploaded images to it.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className='mb-4 space-y-4 border-b border-white/10 pb-4'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1'>
                            <h3 className='text-sm font-medium text-white'>Licensed characters</h3>
                            <p className='mt-1 max-w-4xl text-xs leading-5 text-white/45'>
                                Submit proof that you can use a celebrity likeness or copyrighted character. Approval
                                only unblocks this studio&apos;s own reference check; BytePlus may still refuse the
                                image during automated moderation.
                            </p>
                        </div>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => void refreshAuthorizations()}
                            disabled={isLoadingAuthorizations}
                            className='h-auto rounded-md px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white'>
                            <RefreshCw size={13} className={isLoadingAuthorizations ? 'animate-spin' : undefined} />
                            <span className='ml-1'>Refresh</span>
                        </Button>
                    </div>

                    {authorizationNotice && <p className='text-xs text-emerald-300'>{authorizationNotice}</p>}
                    {authorizationError && <p className='text-xs text-red-400'>{authorizationError}</p>}

                    {authorizationQueue !== null && (
                        <section className='space-y-3 rounded-md border border-white/10 bg-white/[0.03] p-3'>
                            <div className='flex items-center justify-between gap-3'>
                                <h4 className='text-sm font-medium text-white'>
                                    Authorization review queue ({authorizationQueue.length})
                                </h4>
                            </div>
                            {authorizationQueue.length === 0 ? (
                                <p className='text-sm text-white/40'>
                                    No authorization submissions waiting for review.
                                </p>
                            ) : (
                                <div className='grid gap-3 lg:grid-cols-2'>
                                    {authorizationQueue.map((item) => (
                                        <AuthorizationQueueCard
                                            key={item.id}
                                            item={item}
                                            reviewingId={reviewingAuthorizationId}
                                            reviewNote={authorizationReviewNotes[item.id] ?? ''}
                                            onReviewNoteChange={(id, note) =>
                                                setAuthorizationReviewNotes((prev) => ({ ...prev, [id]: note }))
                                            }
                                            onReview={handleReviewAuthorization}
                                            fetchAuthorizationDoc={fetchAuthorizationDoc}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    <form
                        onSubmit={(event) => void handleSubmitAuthorization(event)}
                        className='max-w-5xl space-y-4'>
                        <div className='flex items-start gap-2'>
                            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-amber-200/80' />
                            <div className='min-w-0'>
                                <h4 className='text-sm font-medium text-white'>Submit authorization</h4>
                                <p className='mt-0.5 text-xs text-white/40'>
                                    Pick the blocked reference, name the subject, then attach the authorization file.
                                </p>
                            </div>
                        </div>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(12rem,0.85fr)]'>
                            <div className='space-y-1.5'>
                                <Label htmlFor='authorization-reference' className='text-xs text-white/70'>
                                    Reference media
                                </Label>
                                {authorizationTargetOptions.length > 0 ? (
                                    <div className='grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2'>
                                        {selectedAuthorizationTarget && (
                                            <div className='h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/5'>
                                                {selectedAuthorizationTarget.kind === 'video' ? (
                                                    <video
                                                        src={`${selectedAuthorizationTarget.url}#t=0.001`}
                                                        muted
                                                        playsInline
                                                        preload='metadata'
                                                        className='h-full w-full object-cover'
                                                    />
                                                ) : (
                                                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary reference URL
                                                    <img
                                                        src={selectedAuthorizationTarget.url}
                                                        alt={selectedAuthorizationTarget.label}
                                                        className='h-full w-full object-cover'
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div className='relative min-w-0'>
                                            <select
                                                id='authorization-reference'
                                                value={authorizationReferenceKey}
                                                onChange={(event) => setAuthorizationReferenceKey(event.target.value)}
                                                disabled={isSubmittingAuthorization}
                                                className='h-10 w-full appearance-none rounded-md border border-white/20 bg-black px-3 pr-10 text-sm text-white disabled:opacity-40'>
                                                {authorizationTargetOptions.map((target) => (
                                                    <option key={target.key} value={target.key}>
                                                        {target.label}
                                                        {target.authorizationId ? ` · ${target.authorizationId}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className='pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-white/55' />
                                        </div>
                                    </div>
                                ) : (
                                    <div className='rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3'>
                                        <p className='text-xs leading-5 text-amber-100/80'>
                                            Mark a video reference image or video as a celebrity or licensed character
                                            first, or upload that media to Assets. This lets Studio know which media the
                                            authorization document belongs to.
                                        </p>
                                        {onMarkReferenceForAuthorization && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={onMarkReferenceForAuthorization}
                                                className='mt-2 h-8 rounded-md border border-amber-200/20 px-2 text-xs text-amber-100 hover:bg-amber-200/10 hover:text-white'>
                                                Go to reference image
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor='authorization-subject' className='text-xs text-white/70'>
                                    Subject name
                                </Label>
                                <Input
                                    id='authorization-subject'
                                    value={authorizationSubjectName}
                                    onChange={(event) => setAuthorizationSubjectName(event.target.value)}
                                    placeholder='Celebrity or character name'
                                    disabled={isSubmittingAuthorization || authorizationTargetOptions.length === 0}
                                    className='h-10 rounded-md border border-white/20 bg-black text-sm text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                                />
                            </div>
                        </div>
                        <div className='space-y-1.5'>
                            <Label htmlFor='authorization-note' className='text-xs text-white/70'>
                                Note
                            </Label>
                            <textarea
                                id='authorization-note'
                                value={authorizationNote}
                                onChange={(event) => setAuthorizationNote(event.target.value)}
                                placeholder='Agreement summary, usage scope, reviewer context'
                                disabled={isSubmittingAuthorization || authorizationTargetOptions.length === 0}
                                className='min-h-20 w-full resize-y rounded-md border border-white/20 bg-black px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                            />
                        </div>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start'>
                            <div className='space-y-1.5'>
                                <Label htmlFor='authorization-doc' className='text-xs text-white/70'>
                                    Authorization document
                                </Label>
                                <Input
                                    ref={authorizationFileInputRef}
                                    id='authorization-doc'
                                    type='file'
                                    accept='application/pdf,image/png,image/jpeg,image/webp'
                                    onChange={(event) => setAuthorizationFile(event.target.files?.[0] ?? null)}
                                    disabled={isSubmittingAuthorization || authorizationTargetOptions.length === 0}
                                    className='h-10 rounded-md border border-white/20 bg-black text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20 disabled:opacity-40'
                                />
                                <p className='text-[10px] text-white/35'>PDF · PNG · JPEG · WebP · up to 5 MB</p>
                            </div>
                            <Button
                                type='submit'
                                disabled={
                                    isSubmittingAuthorization ||
                                    authorizationTargetOptions.length === 0 ||
                                    !authorizationReferenceKey ||
                                    !authorizationSubjectName.trim() ||
                                    !authorizationFile
                                }
                                className='mt-5 h-10 min-w-40 bg-white px-4 text-sm text-black hover:bg-white/90 disabled:bg-white/40 md:mt-[1.375rem]'>
                                {isSubmittingAuthorization ? (
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                ) : (
                                    <ShieldCheck className='h-3 w-3' />
                                )}
                                Submit for review
                            </Button>
                        </div>
                    </form>

                    <div className='space-y-3'>
                        <div className='flex items-center justify-between gap-2'>
                            <h4 className='text-sm font-medium text-white'>Your submissions</h4>
                            {isLoadingAuthorizations && (
                                <span className='inline-flex items-center gap-1 text-[10px] text-white/40'>
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                    Loading
                                </span>
                            )}
                        </div>
                        {authorizations === null && isLoadingAuthorizations ? (
                            <div className='flex items-center gap-2 text-xs text-white/40'>
                                <Loader2 className='h-3 w-3 animate-spin' />
                                Loading authorizations...
                            </div>
                        ) : (authorizations ?? []).length === 0 ? (
                            <p className='text-xs text-white/40'>No authorization submissions yet.</p>
                        ) : (
                            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                {(authorizations ?? []).map((item) => (
                                    <AuthorizationListItem
                                        key={item.id}
                                        item={item}
                                        fetchAuthorizationDoc={fetchAuthorizationDoc}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

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
                            <div key={asset.key} className='flex h-full flex-col' title={asset.key}>
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
                                    <button
                                        type='button'
                                        title='Delete from cloud storage'
                                        onClick={() => void handleDelete(asset)}
                                        className='absolute top-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600/85 text-white shadow-sm transition-colors hover:bg-red-500'>
                                        <Trash2 size={12} />
                                    </button>
                                    <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2 pt-8 pb-2'>
                                        <div className='h-4 truncate text-xs text-white/90'>
                                            {asset.name || asset.key.split('/').pop() || asset.key}
                                        </div>
                                        <div className='mt-1 flex h-4 items-center justify-between text-[10px] text-white/55'>
                                            <span>
                                                {asset.uploaded ? new Date(asset.uploaded).toLocaleDateString() : ''}
                                            </span>
                                            <span>{formatBytes(asset.bytes)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className='rounded-b-md border border-t-0 border-white/20 bg-neutral-900/50 p-2'>
                                    <div
                                        className={
                                            asset.kind === 'image'
                                                ? 'grid grid-cols-3 gap-1.5'
                                                : 'grid grid-cols-2 gap-1.5'
                                        }>
                                        {asset.kind === 'image' && (
                                            <>
                                                <button
                                                    type='button'
                                                    title='Add to the video form as a reference image'
                                                    onClick={() => onUseAsReference(asset.url)}
                                                    className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                    <ImagePlus size={11} />
                                                    Use as ref
                                                </button>
                                                <CopyUrlButton url={asset.url} />
                                                <button
                                                    type='button'
                                                    title='Save this image as a named character'
                                                    onClick={() => openCharacterDialog(asset)}
                                                    className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
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
                                                className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
                                                <Video size={11} />
                                                Use as ref video
                                            </button>
                                        )}
                                        {asset.kind !== 'image' && <CopyUrlButton url={asset.url} />}
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
