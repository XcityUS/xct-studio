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
    disabled
}: ReferenceImagesInputProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [urlDraft, setUrlDraft] = React.useState('');

    const remaining = maxImages - urls.length;
    const canUpload = Boolean(onUpload);
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

    const hint =
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
                {maxImages > 1 ? 'Reference Images (Optional)' : 'Reference Image (Optional)'}
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
                    <div className='space-y-2'>
                        {unresolvedDeclarations.map((item) => {
                            const declaration = declarationForUrl(declarations, item.url);
                            const actionLabel = declaration?.origin ? declarationActionLabel(declaration.origin) : null;
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
                                        <div className='flex flex-wrap items-center gap-2 text-xs text-amber-100/80'>
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
