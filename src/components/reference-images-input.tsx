'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ASSET_LIBRARY_MODEL_BLOCK_REASON,
    REFERENCE_ORIGINS,
    REFERENCE_ORIGIN_LABELS,
    declarationSatisfied,
    isAssetReferenceUrl,
    originRequiresAssetLibrary,
    refKey,
    type ReferenceDeclaration,
    type ReferenceOrigin
} from '@/lib/reference-origin';
import type { VideoCharacter, VideoPortrait } from '@/lib/history-merge';
import type { UserAsset } from '@/lib/media-archive';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, ImagePlus, Link2, Loader2, ShieldCheck, X } from 'lucide-react';
import * as React from 'react';

interface ReferenceImagesInputProps {
    /** Public image URLs, in order — [Image 1], [Image 2], … in the prompt. */
    urls: string[];
    onChange: (urls: string[]) => void;
    /** Per-model cap: 1 = first-frame only, 9 = Seedance 2.x reference mode. */
    maxImages: number;
    /** Optional last-frame URL used only when exactly one first-frame image is set. */
    lastFrameUrl?: string;
    onLastFrameChange?: (url: string) => void;
    /** Uploads a local file and resolves to its public URL. Absent = URL-only mode. */
    onUpload?: (file: File) => Promise<string>;
    declarations: Record<string, ReferenceDeclaration>;
    onDeclare: (url: string, origin: ReferenceOrigin) => void;
    approvedAuthorizationIds: ReadonlySet<string>;
    onOpenAssets?: (referenceKey?: string) => void;
    characters?: VideoCharacter[];
    portraits?: VideoPortrait[];
    imageAssets?: UserAsset[];
    isLoadingImageAssets?: boolean;
    onRefreshImageAssets?: () => void;
    onCreateVirtualAsset?: (input: { url: string; name: string }) => Promise<string>;
    label?: string;
    hint?: string;
    showCharacters?: boolean;
    showAssetLibrary?: boolean;
    disabled?: boolean;
}

function isHttpImageUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isReferenceImageUrl(url: string): boolean {
    return isHttpImageUrl(url) || isAssetReferenceUrl(url);
}

function assetReferenceLabel(url: string): string {
    const assetId = url.trim().replace(/^asset:\/\//, '');
    return assetId.length > 8 ? assetId.slice(-8) : assetId;
}

function portraitReferenceUrl(assetId: string): string {
    return `asset://${assetId}`;
}

function declarationForUrl(
    declarations: Record<string, ReferenceDeclaration>,
    url: string
): ReferenceDeclaration | undefined {
    const key = refKey(url);
    return key ? declarations[key] : undefined;
}

function declarationActionLabel(origin: ReferenceOrigin): string | null {
    if (origin === 'thirdparty-ai' || origin === 'real-person') return 'Set this up in Assets';
    if (origin === 'licensed-ip') return 'Submit authorization';
    return null;
}

function ReferenceStatusBadge({
    declaration,
    approvedAuthorizationIds
}: {
    declaration: ReferenceDeclaration | undefined;
    approvedAuthorizationIds: ReadonlySet<string>;
}) {
    const satisfied = declarationSatisfied(declaration, approvedAuthorizationIds);
    const title = satisfied ? 'Declaration complete' : declaration ? 'Needs setup before submit' : 'Choose origin';
    return (
        <span
            title={title}
            className={cn(
                'absolute right-0 bottom-0 flex h-4 w-4 items-center justify-center rounded-tl border border-black/50 text-[10px] font-semibold',
                satisfied ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'
            )}>
            {satisfied ? <Check className='h-3 w-3' /> : declaration ? <AlertTriangle className='h-3 w-3' /> : '?'}
        </span>
    );
}

function ReferencePreview({ url, alt, className }: { url: string; alt: string; className: string }) {
    return (
        <div className={cn('shrink-0 overflow-hidden rounded-md border border-white/20 bg-white/5', className)}>
            {isAssetReferenceUrl(url) ? (
                <div
                    title={url}
                    className='flex h-full w-full flex-col items-center justify-center gap-1 bg-emerald-400/[0.06] px-1 text-center'>
                    <ShieldCheck className='h-4 w-4 text-emerald-300' />
                    <span className='max-w-full truncate font-mono text-[9px] text-emerald-100/80'>
                        {assetReferenceLabel(url)}
                    </span>
                </div>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary worker/external URL
                <img
                    src={url}
                    alt={alt}
                    title={url}
                    className='h-full w-full object-cover'
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                    }}
                />
            )}
        </div>
    );
}

type LastFrameSlotProps = {
    url: string;
    onChange: (url: string) => void;
    onUpload?: (file: File) => Promise<string>;
    declaration?: ReferenceDeclaration;
    approvedAuthorizationIds: ReadonlySet<string>;
    disabled?: boolean;
};

function LastFrameSlot({
    url,
    onChange,
    onUpload,
    declaration,
    approvedAuthorizationIds,
    disabled
}: LastFrameSlotProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [urlDraft, setUrlDraft] = React.useState('');

    const canUpload = Boolean(onUpload);

    const commitDraft = React.useCallback(
        (value?: string) => {
            const draft = (value ?? urlDraft).trim();
            if (!draft) return;
            if (!isHttpImageUrl(draft)) {
                setUploadError('Enter a valid http(s) image URL.');
                return;
            }
            onChange(draft);
            setUrlDraft('');
            setUploadError(null);
        },
        [urlDraft, onChange]
    );

    const handleFiles = React.useCallback(
        async (files: FileList | File[] | null | undefined) => {
            const file = files?.[0];
            if (!file || !onUpload || disabled) return;
            setIsUploading(true);
            setUploadError(null);
            try {
                onChange(await onUpload(file));
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Upload failed.');
            } finally {
                setIsUploading(false);
            }
        },
        [onUpload, disabled, onChange]
    );

    return (
        <div className='space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-3'>
            <Label className='text-xs text-white/70'>Last frame (optional)</Label>

            {url ? (
                <div className='relative h-16 w-16 overflow-hidden rounded-md border border-white/20 bg-white/5'>
                    <ReferencePreview url={url} alt='Last frame reference' className='h-full w-full border-0' />
                    <span className='absolute bottom-0 left-0 rounded-tr bg-black/70 px-1 text-[10px] text-white/80'>
                        last
                    </span>
                    <button
                        type='button'
                        onClick={() => {
                            onChange('');
                            setUploadError(null);
                        }}
                        disabled={disabled}
                        className='absolute top-0 right-0 rounded-bl bg-black/70 p-0.5 text-white/70 transition-colors hover:text-white'
                        aria-label='Remove last frame'>
                        <X className='h-3 w-3' />
                    </button>
                    <ReferenceStatusBadge
                        declaration={declaration}
                        approvedAuthorizationIds={approvedAuthorizationIds}
                    />
                </div>
            ) : (
                <>
                    {canUpload && (
                        <div
                            role='button'
                            tabIndex={disabled ? -1 : 0}
                            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (!disabled) setIsDragOver(true);
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                void handleFiles(e.dataTransfer.files);
                            }}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-4 text-center transition-colors',
                                isDragOver
                                    ? 'border-white/60 bg-white/10'
                                    : 'border-white/25 bg-black hover:border-white/40 hover:bg-white/5',
                                (disabled || isUploading) && 'pointer-events-none opacity-50'
                            )}>
                            {isUploading ? (
                                <>
                                    <Loader2 className='h-5 w-5 animate-spin text-white/60' />
                                    <p className='text-xs text-white/60'>Uploading…</p>
                                </>
                            ) : (
                                <>
                                    <ImagePlus className='h-5 w-5 text-white/50' />
                                    <p className='text-xs text-white/60'>
                                        Drop the final frame here or click to upload
                                    </p>
                                    <p className='text-[10px] text-white/35'>PNG · JPEG · WebP · up to 10 MB</p>
                                </>
                            )}
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        className='hidden'
                        onChange={(e) => {
                            void handleFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />

                    {canUpload && !showUrlInput ? (
                        <button
                            type='button'
                            onClick={() => setShowUrlInput(true)}
                            disabled={disabled}
                            className='flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70'>
                            <Link2 className='h-3 w-3' />
                            Use an image URL instead
                        </button>
                    ) : (
                        <div className='flex gap-2'>
                            <Input
                                type='url'
                                placeholder='https://…/last-frame.png'
                                value={urlDraft}
                                onChange={(e) => setUrlDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitDraft();
                                    }
                                }}
                                onBlur={() => commitDraft()}
                                onPaste={(e) => {
                                    const pasted = e.clipboardData.getData('text');
                                    if (pasted.trim()) {
                                        e.preventDefault();
                                        commitDraft(pasted);
                                    }
                                }}
                                disabled={disabled}
                                className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            />
                            <button
                                type='button'
                                onClick={() => commitDraft()}
                                disabled={disabled || !urlDraft.trim()}
                                className='shrink-0 rounded-md border border-white/20 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40'>
                                Add
                            </button>
                        </div>
                    )}
                </>
            )}

            {uploadError && <p className='text-xs text-red-400'>{uploadError}</p>}
        </div>
    );
}

/**
 * Reference image picker for image-to-video.
 *
 * Semantics mirror the request builder: exactly one image = first-frame mode
 * (output ratio follows the image); two or more = Seedance 2.x multi-reference
 * mode (role "reference_image", prompt cites [Image 1], [Image 2], …).
 */
export function ReferenceImagesInput({
    urls,
    onChange,
    maxImages,
    lastFrameUrl = '',
    onLastFrameChange,
    onUpload,
    declarations,
    onDeclare,
    approvedAuthorizationIds,
    onOpenAssets,
    characters = [],
    portraits = [],
    imageAssets = [],
    isLoadingImageAssets = false,
    onRefreshImageAssets,
    onCreateVirtualAsset,
    label,
    hint: hintOverride,
    showCharacters = true,
    showAssetLibrary = false,
    disabled
}: ReferenceImagesInputProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [creatingVirtualKey, setCreatingVirtualKey] = React.useState<string | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [setupError, setSetupError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [showStoredImages, setShowStoredImages] = React.useState(false);
    const [urlDraft, setUrlDraft] = React.useState('');
    const [virtualNames, setVirtualNames] = React.useState<Record<string, string>>({});

    const remaining = maxImages - urls.length;
    const canUpload = Boolean(onUpload);
    const attachablePortraits =
        maxImages > 1
            ? portraits.filter((portrait) => !urls.includes(portraitReferenceUrl(portrait.assetId)))
            : [];
    const attachableCharacters = characters.filter((character) => !urls.includes(character.url));
    const attachableImageAssets = imageAssets.filter((asset) => asset.kind === 'image' && !urls.includes(asset.url));
    const unresolvedDeclarations = React.useMemo(() => {
        const items = urls.map((url, i) => ({ url, label: `Image ${i + 1}` }));
        if (lastFrameUrl.trim()) {
            items.push({ url: lastFrameUrl, label: 'Last frame' });
        }
        return items.filter(
            (item) => !declarationSatisfied(declarationForUrl(declarations, item.url), approvedAuthorizationIds)
        );
    }, [approvedAuthorizationIds, declarations, lastFrameUrl, urls]);

    const addUrls = React.useCallback(
        (added: string[]) => {
            const cleaned = added.map((u) => u.trim()).filter(isReferenceImageUrl);
            if (!cleaned.length) return;
            const next = [...urls, ...cleaned.filter((u) => !urls.includes(u))].slice(0, maxImages);
            onChange(next);
        },
        [urls, maxImages, onChange]
    );

    /**
     * A URL sitting in the draft box is NOT part of the request — commit it on
     * every exit path (Enter, Add, blur, paste), because "pasted but never
     * pressed Add" silently generated without the reference.
     */
    const commitDraft = React.useCallback(
        (value?: string) => {
            const draft = (value ?? urlDraft).trim();
            if (!draft) return;
            addUrls([draft]);
            setUrlDraft('');
        },
        [urlDraft, addUrls]
    );

    const handleFiles = React.useCallback(
        async (files: FileList | File[] | null | undefined) => {
            if (!files || !onUpload || disabled) return;
            const batch = Array.from(files).slice(0, Math.max(0, remaining));
            if (!batch.length) return;
            setIsUploading(true);
            setUploadError(null);
            try {
                const uploaded: string[] = [];
                for (const file of batch) {
                    uploaded.push(await onUpload(file));
                }
                addUrls(uploaded);
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Upload failed.');
            } finally {
                setIsUploading(false);
            }
        },
        [onUpload, disabled, remaining, addUrls]
    );

    const removeAt = (index: number) => {
        onChange(urls.filter((_, i) => i !== index));
        setUploadError(null);
    };

    const replaceUrl = (fromUrl: string, toUrl: string) => {
        onChange(urls.map((url) => (url === fromUrl ? toUrl : url)));
        setUploadError(null);
        setSetupError(null);
    };

    const createVirtualAsset = async (url: string, label: string) => {
        if (!onCreateVirtualAsset || disabled) return;
        const key = refKey(url);
        if (!key) return;
        const name = virtualNames[key]?.trim() || label;
        setCreatingVirtualKey(key);
        setSetupError(null);
        try {
            const assetUrl = await onCreateVirtualAsset({ url, name });
            replaceUrl(url, assetUrl);
        } catch (err) {
            setSetupError(err instanceof Error ? err.message : 'Could not create virtual asset.');
        } finally {
            setCreatingVirtualKey(null);
        }
    };

    const hint =
        hintOverride ??
        maxImages <= 1
            ? 'Image-to-video: the clip starts from this frame; the output ratio follows the image. Switch to Seedance 2.0/2.5 to use multiple reference images.'
            : urls.length >= 2
              ? `Reference mode — cite [Image 1], [Image 2] … in your prompt (up to ${maxImages} images). Aspect ratio applies.`
              : urls.length === 1
                ? 'One image = first-frame mode (output ratio follows it). Add more to switch to reference mode.'
                : `First image starts the clip; add 2+ (up to ${maxImages}) for reference mode with [Image n] prompts.`;

    return (
        <div className='space-y-2'>
            <Label className='text-white'>
                {label ?? (maxImages > 1 ? 'Reference Images (Optional)' : 'Reference Image (Optional)')}
            </Label>

            {urls.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                    {urls.map((url, i) => (
                        <div
                            key={`${url}-${i}`}
                            className='relative h-16 w-16 overflow-hidden rounded-md border border-white/20 bg-white/5'>
                            {isAssetReferenceUrl(url) ? (
                                <div
                                    title={url}
                                    className='flex h-full w-full flex-col items-center justify-center gap-1 bg-emerald-400/[0.06] px-1 text-center'>
                                    <ShieldCheck className='h-5 w-5 text-emerald-300' />
                                    <span className='max-w-full truncate font-mono text-[10px] text-emerald-100/80'>
                                        {assetReferenceLabel(url)}
                                    </span>
                                </div>
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element -- arbitrary worker/external URL
                                <img
                                    src={url}
                                    alt={`Reference ${i + 1}`}
                                    title={url}
                                    className='h-full w-full object-cover'
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                                    }}
                                />
                            )}
                            <span className='absolute bottom-0 left-0 rounded-tr bg-black/70 px-1 text-[10px] text-white/80'>
                                {i + 1}
                            </span>
                            <button
                                type='button'
                                onClick={() => removeAt(i)}
                                disabled={disabled}
                                className='absolute top-0 right-0 rounded-bl bg-black/70 p-0.5 text-white/70 transition-colors hover:text-white'
                                aria-label={`Remove reference image ${i + 1}`}>
                                <X className='h-3 w-3' />
                            </button>
                            <ReferenceStatusBadge
                                declaration={declarationForUrl(declarations, url)}
                                approvedAuthorizationIds={approvedAuthorizationIds}
                            />
                        </div>
                    ))}
                </div>
            )}

            {showCharacters && remaining > 0 && attachableCharacters.length > 0 && (
                <div className='space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm text-white/80'>Characters:</span>
                        <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                            {attachableCharacters.map((character) => (
                                <button
                                    key={character.id}
                                    type='button'
                                    title={`Attach ${character.name}`}
                                    onClick={() => addUrls([character.url])}
                                    disabled={disabled}
                                    className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pr-2 pl-1 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                    <span className='h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5'>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- user stored character thumbnail */}
                                        <img
                                            src={character.url}
                                            alt={character.name}
                                            loading='lazy'
                                            className='h-full w-full object-cover'
                                        />
                                    </span>
                                    <span className='max-w-32 truncate'>{character.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {remaining > 0 && (attachableImageAssets.length > 0 || isLoadingImageAssets || onRefreshImageAssets) && (
                <div className='space-y-2'>
                    <div className='flex items-center justify-between gap-2'>
                        <button
                            type='button'
                            onClick={() => setShowStoredImages((current) => !current)}
                            className='text-sm text-white/50 transition-colors hover:text-white/80'>
                            {showStoredImages ? 'Hide stored images' : 'Show stored images'}
                        </button>
                        {showStoredImages && onRefreshImageAssets && (
                            <button
                                type='button'
                                onClick={onRefreshImageAssets}
                                disabled={disabled || isLoadingImageAssets}
                                className='rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                {isLoadingImageAssets ? 'Loading...' : 'Refresh'}
                            </button>
                        )}
                    </div>
                    {showStoredImages && attachableImageAssets.length > 0 ? (
                        <div className='flex gap-2 overflow-x-auto pb-1'>
                            {attachableImageAssets.slice(0, 24).map((asset) => (
                                <button
                                    key={asset.key}
                                    type='button'
                                    title={asset.name ?? asset.key}
                                    onClick={() => addUrls([asset.url])}
                                    disabled={disabled}
                                    className='group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-white/15 bg-white/5 transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-45'>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- user stored image asset */}
                                    <img
                                        src={asset.url}
                                        alt={asset.name ?? 'Stored image'}
                                        loading='lazy'
                                        className='h-full w-full object-cover'
                                    />
                                    <span className='absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-[10px] text-white/80'>
                                        {asset.name ?? 'Image'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : showStoredImages ? (
                        <p className='text-xs text-white/45'>
                            {isLoadingImageAssets ? 'Loading stored images...' : 'No stored image assets found.'}
                        </p>
                    ) : null}
                </div>
            )}

            {showAssetLibrary && remaining > 0 && (attachablePortraits.length > 0 || onOpenAssets) && (
                <div className='space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm text-white/80'>Asset library:</span>
                        <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                            {attachablePortraits.map((portrait) => (
                                <button
                                    key={portrait.assetId}
                                    type='button'
                                    title={`Attach ${portrait.name}`}
                                    onClick={() => addUrls([portraitReferenceUrl(portrait.assetId)])}
                                    disabled={disabled}
                                    className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pr-2 pl-1 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                    <span className='h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5'>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted asset thumbnail */}
                                        <img
                                            src={portrait.thumbUrl}
                                            alt={portrait.name}
                                            loading='lazy'
                                            className='h-full w-full object-cover'
                                        />
                                    </span>
                                    <span className='max-w-32 truncate'>{portrait.name}</span>
                                    <span className='text-[10px] text-white/40'>
                                        {portrait.groupType === 'AIGC' ? 'Virtual' : 'Verified'}
                                    </span>
                                </button>
                            ))}
                            {attachablePortraits.length === 0 && (
                                <span className='text-xs text-white/45'>
                                    No verified or virtual character assets are ready.
                                </span>
                            )}
                            {onOpenAssets && (
                                <button
                                    type='button'
                                    onClick={() => onOpenAssets()}
                                    disabled={disabled}
                                    className='rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                    Open Assets
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {urls.length === 1 && onLastFrameChange && (
                <LastFrameSlot
                    url={lastFrameUrl}
                    onChange={onLastFrameChange}
                    onUpload={onUpload}
                    declaration={declarationForUrl(declarations, lastFrameUrl)}
                    approvedAuthorizationIds={approvedAuthorizationIds}
                    disabled={disabled}
                />
            )}

            {unresolvedDeclarations.length > 0 && (
                <div className='space-y-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3'>
                    <p className='text-sm text-white'>Where did these come from?</p>
                    {setupError && (
                        <div className='rounded-md border border-red-400/25 bg-red-500/[0.08] px-2 py-1.5 text-xs text-red-200'>
                            {setupError}
                        </div>
                    )}
                    <div className='space-y-2'>
                        {unresolvedDeclarations.map((item) => {
                            const declaration = declarationForUrl(declarations, item.url);
                            const actionLabel = declaration?.origin ? declarationActionLabel(declaration.origin) : null;
                            const mappingGroup =
                                declaration?.origin === 'thirdparty-ai'
                                    ? 'AIGC'
                                    : declaration?.origin === 'real-person'
                                      ? 'LivenessFace'
                                      : null;
                            const mappingOptions = mappingGroup
                                ? portraits.filter((portrait) => portrait.groupType === mappingGroup)
                                : [];
                            const assetLibraryUnsupported =
                                maxImages <= 1 &&
                                Boolean(declaration && originRequiresAssetLibrary(declaration.origin));
                            const canOpenAssets =
                                Boolean(onOpenAssets) &&
                                Boolean(
                                    declaration?.origin === 'thirdparty-ai' ||
                                        declaration?.origin === 'real-person' ||
                                        declaration?.origin === 'licensed-ip'
                                ) &&
                                !assetLibraryUnsupported;
                            const referenceKey = refKey(item.url);
                            const canCreateVirtual =
                                Boolean(onCreateVirtualAsset) &&
                                declaration?.origin === 'thirdparty-ai' &&
                                !assetLibraryUnsupported;
                            const isCreatingVirtual = creatingVirtualKey === referenceKey;
                            return (
                                <div
                                    key={`${item.label}-${item.url}`}
                                    className='grid gap-2 rounded-md border border-white/10 bg-black/40 p-2 sm:grid-cols-[auto_auto_1fr] sm:items-center'>
                                    <div className='flex items-center gap-2'>
                                        <ReferencePreview
                                            url={item.url}
                                            alt={`${item.label} declaration`}
                                            className='h-8 w-8'
                                        />
                                        <span className='w-14 text-xs text-white/50'>{item.label}</span>
                                    </div>
                                    <Select
                                        value={declaration?.origin ?? ''}
                                        onValueChange={(value) => onDeclare(item.url, value as ReferenceOrigin)}
                                        disabled={disabled}>
                                        <SelectTrigger className='h-9 border-white/20 bg-black text-xs text-white focus:border-white/50 focus:ring-white/50 sm:w-64'>
                                            <SelectValue placeholder='Select origin' />
                                        </SelectTrigger>
                                        <SelectContent className='border-white/20 bg-black text-white'>
                                            {REFERENCE_ORIGINS.map((origin) => (
                                                <SelectItem
                                                    key={origin}
                                                    value={origin}
                                                    className='focus:bg-white/10 focus:text-white'>
                                                    {REFERENCE_ORIGIN_LABELS[origin].label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {declaration?.origin && actionLabel && (
                                        <div className='flex flex-wrap items-center gap-2 text-xs text-amber-100/80 sm:col-span-3 sm:col-start-3'>
                                            <span className='min-w-0 flex-1'>
                                                {assetLibraryUnsupported
                                                    ? ASSET_LIBRARY_MODEL_BLOCK_REASON
                                                    : REFERENCE_ORIGIN_LABELS[declaration.origin].hint}
                                            </span>
                                            <button
                                                type='button'
                                                title={
                                                    canOpenAssets
                                                        ? 'Open Assets'
                                                        : assetLibraryUnsupported
                                                          ? 'Switch model first'
                                                          : 'Open Assets'
                                                }
                                                onClick={() =>
                                                    canOpenAssets &&
                                                    onOpenAssets?.(
                                                        declaration?.origin === 'licensed-ip' ? referenceKey : undefined
                                                    )
                                                }
                                                disabled={!canOpenAssets || disabled}
                                                className='shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/40'>
                                                {assetLibraryUnsupported ? 'Switch model first' : actionLabel}
                                            </button>
                                            {!assetLibraryUnsupported && mappingOptions.length > 0 && (
                                                <div className='flex basis-full flex-wrap items-center gap-1.5 pt-1'>
                                                    <span className='mr-1 text-white/45'>
                                                        Map to existing:
                                                    </span>
                                                    {mappingOptions.map((portrait) => {
                                                        const assetUrl = portraitReferenceUrl(portrait.assetId);
                                                        const selected = urls.includes(assetUrl);
                                                        return (
                                                            <button
                                                                key={portrait.assetId}
                                                                type='button'
                                                                title={`Use ${portrait.name}`}
                                                                onClick={() => replaceUrl(item.url, assetUrl)}
                                                                disabled={disabled || selected}
                                                                className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pr-2 pl-1 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                                                <span className='h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5'>
                                                                    {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted asset thumbnail */}
                                                                    <img
                                                                        src={portrait.thumbUrl}
                                                                        alt={portrait.name}
                                                                        loading='lazy'
                                                                        className='h-full w-full object-cover'
                                                                    />
                                                                </span>
                                                                <span className='max-w-32 truncate'>{portrait.name}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {canCreateVirtual && (
                                                <div className='flex basis-full flex-wrap items-center gap-2 pt-1'>
                                                    <Input
                                                        value={virtualNames[referenceKey] ?? ''}
                                                        onChange={(event) =>
                                                            setVirtualNames((current) => ({
                                                                ...current,
                                                                [referenceKey]: event.target.value
                                                            }))
                                                        }
                                                        disabled={disabled || isCreatingVirtual}
                                                        placeholder='Virtual character name'
                                                        className='h-8 min-w-40 flex-1 border-white/20 bg-black text-xs text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                                                    />
                                                    <button
                                                        type='button'
                                                        onClick={() => void createVirtualAsset(item.url, item.label)}
                                                        disabled={disabled || isCreatingVirtual}
                                                        className='inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2 text-xs text-cyan-100 transition-colors hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-45'>
                                                        {isCreatingVirtual && (
                                                            <Loader2 className='h-3 w-3 animate-spin' />
                                                        )}
                                                        Create virtual asset
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {remaining > 0 && (
                <>
                    {canUpload && (
                        <div
                            role='button'
                            tabIndex={disabled ? -1 : 0}
                            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (!disabled) setIsDragOver(true);
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                void handleFiles(e.dataTransfer.files);
                            }}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-4 text-center transition-colors',
                                isDragOver
                                    ? 'border-white/60 bg-white/10'
                                    : 'border-white/25 bg-black hover:border-white/40 hover:bg-white/5',
                                (disabled || isUploading) && 'pointer-events-none opacity-50'
                            )}>
                            {isUploading ? (
                                <>
                                    <Loader2 className='h-5 w-5 animate-spin text-white/60' />
                                    <p className='text-xs text-white/60'>Uploading…</p>
                                </>
                            ) : (
                                <>
                                    <ImagePlus className='h-5 w-5 text-white/50' />
                                    <p className='text-xs text-white/60'>
                                        {urls.length ? 'Add another image' : 'Drop an image here or click to upload'}
                                    </p>
                                    <p className='text-[10px] text-white/35'>PNG · JPEG · WebP · up to 10 MB</p>
                                </>
                            )}
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        multiple={maxImages > 1}
                        className='hidden'
                        onChange={(e) => {
                            void handleFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />

                    {canUpload && !showUrlInput ? (
                        <button
                            type='button'
                            onClick={() => setShowUrlInput(true)}
                            disabled={disabled}
                            className='flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70'>
                            <Link2 className='h-3 w-3' />
                            Use an image URL instead
                        </button>
                    ) : (
                        <div className='flex gap-2'>
                            <Input
                                type='url'
                                placeholder='https://…/image.png or asset://…'
                                value={urlDraft}
                                onChange={(e) => setUrlDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitDraft();
                                    }
                                }}
                                onBlur={() => commitDraft()}
                                onPaste={(e) => {
                                    const pasted = e.clipboardData.getData('text');
                                    if (pasted.trim()) {
                                        e.preventDefault();
                                        commitDraft(pasted);
                                    }
                                }}
                                disabled={disabled}
                                className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            />
                            <button
                                type='button'
                                onClick={() => commitDraft()}
                                disabled={disabled || !urlDraft.trim()}
                                className='shrink-0 rounded-md border border-white/20 px-3 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40'>
                                Add
                            </button>
                        </div>
                    )}
                </>
            )}

            {uploadError && <p className='text-xs text-red-400'>{uploadError}</p>}
            <p className='text-xs text-white/40'>{hint}</p>
        </div>
    );
}
