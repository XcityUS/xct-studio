'use client';

import { LastFrameSlot } from './LastFrameSlot';
import { ReferencePreview } from './ReferencePreview';
import { ReviewAction } from './ReviewAction';
import { SelectedReference } from './SelectedReference';
import type { ReferenceImagesInputProps } from './types';
import { declarationForUrl, isReferenceImagePortrait, isReferenceImageUrl } from './utils';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import {
    ASSET_LIBRARY_MODEL_BLOCK_REASON,
    automaticReviewOrigin,
    assetIdFromReferenceUrl,
    declarationSatisfied,
    originRequiresAssetLibrary,
    refKey
} from '@/features/assets/reference/origin';
import { useReferenceCopy } from '@/features/assets/reference/use-copy';
import { characterPreviewUrl } from '@/features/generation/history/characters';
import { cn } from '@/shared/utils/classnames';
import { ImagePlus, Link2, Loader2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

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
    approvedAuthorizationIds,
    onOpenAssets,
    characters = [],
    portraits = [],
    imageAssets = [],
    isLoadingImageAssets = false,
    onRefreshImageAssets,
    onReviewReferenceAsset,
    onSwitchToAssetModel,
    label,
    hint: hintOverride,
    showCharacters = true,
    showAssetLibrary = false,
    disabled
}: ReferenceImagesInputProps) {
    const t = useTranslations();
    const referenceCopy = useReferenceCopy();
    const uploadFailedMessage = t('Upload failed');
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [showStoredImages, setShowStoredImages] = React.useState(false);
    const [urlDraft, setUrlDraft] = React.useState('');
    const [uploadedNames, setUploadedNames] = React.useState<Record<string, string>>({});

    const remaining = maxImages - urls.length;
    const canUpload = Boolean(onUpload);
    const attachablePortraits =
        maxImages > 1
            ? portraits.filter(
                  (portrait) =>
                      isReferenceImagePortrait(portrait) && !urls.includes(portraitReferenceUrl(portrait.assetId))
              )
            : [];
    const attachableCharacters = characters.filter((character) => !urls.includes(character.url));
    const attachableImageAssets = imageAssets.filter((asset) => asset.kind === 'image' && !urls.includes(asset.url));
    const portraitsByAssetId = React.useMemo(
        () => new Map(portraits.map((portrait) => [portrait.assetId, portrait])),
        [portraits]
    );
    const portraitsBySource = React.useMemo(() => {
        const bySource = new Map<string, (typeof portraits)[number]>();
        for (const portrait of portraits) {
            const key = refKey(portrait.thumbUrl);
            const existing = bySource.get(key);
            if (!existing || existing.updatedAt < portrait.updatedAt) bySource.set(key, portrait);
        }
        return bySource;
    }, [portraits]);
    const unresolvedDeclarations = React.useMemo(() => {
        const items = urls.map((url, i) => ({ url, label: `Image ${i + 1}` }));
        if (lastFrameUrl.trim()) {
            items.push({ url: lastFrameUrl, label: 'Last frame' });
        }
        return items.filter(
            (item) => !declarationSatisfied(declarationForUrl(declarations, item.url), approvedAuthorizationIds)
        );
    }, [approvedAuthorizationIds, declarations, lastFrameUrl, urls]);

    const uploadReference = React.useCallback(
        async (file: File) => {
            if (!onUpload) throw new Error(uploadFailedMessage);
            const url = await onUpload(file);
            const key = refKey(url);
            setUploadedNames((current) => ({ ...current, [key]: file.name.replace(/\.[^.]+$/, '').trim() }));
            return url;
        },
        [onUpload, uploadFailedMessage]
    );

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
            const uploaded: string[] = [];
            try {
                for (const file of batch) {
                    uploaded.push(await uploadReference(file));
                }
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : uploadFailedMessage);
            } finally {
                if (uploaded.length) addUrls(uploaded);
                setIsUploading(false);
            }
        },
        [addUrls, disabled, onUpload, remaining, uploadFailedMessage, uploadReference]
    );

    const removeAt = (index: number) => {
        onChange(urls.filter((_, i) => i !== index));
        setUploadError(null);
    };

    const replaceUrl = (fromUrl: string, toUrl: string) => {
        onChange(urls.map((url) => (url === fromUrl ? toUrl : url)));
        setUploadError(null);
    };

    const hint = hintOverride ?? referenceCopy.imageHint(maxImages, urls.length);

    return (
        <div className='space-y-2'>
            <Label className='text-white'>
                {label ??
                    (maxImages > 1
                        ? t('Reference Images <lpar>Optional<rpar>')
                        : t('Reference Image <lpar>Optional<rpar>'))}
            </Label>

            {urls.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                    {urls.map((url, i) => {
                        const declaration = declarationForUrl(declarations, url);
                        const assetId = assetIdFromReferenceUrl(url);
                        return (
                            <SelectedReference
                                key={`${url}-${i}`}
                                url={url}
                                index={i}
                                portrait={
                                    assetId ? portraitsByAssetId.get(assetId) : portraitsBySource.get(refKey(url))
                                }
                                reviewStatus={portraitsBySource.get(refKey(url))?.status}
                                declaration={declaration}
                                approvedAuthorizationIds={approvedAuthorizationIds}
                                disabled={disabled}
                                onRemove={() => removeAt(i)}
                            />
                        );
                    })}
                </div>
            )}

            {showCharacters && remaining > 0 && attachableCharacters.length > 0 && (
                <div className='space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm text-white/80'>{t('Characters<colon>')}</span>
                        <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                            {attachableCharacters.map((character) => (
                                <button
                                    key={character.id}
                                    type='button'
                                    title={t('Attach <lcur>name<rcur>', { name: character.name })}
                                    onClick={() => addUrls([character.url])}
                                    disabled={disabled}
                                    className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pr-2 pl-1 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                    <span className='flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5'>
                                        {characterPreviewUrl(character, portraits) ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- user stored character thumbnail
                                            <img
                                                src={characterPreviewUrl(character, portraits) ?? undefined}
                                                alt={character.name}
                                                loading='lazy'
                                                className='h-full w-full object-cover'
                                            />
                                        ) : (
                                            <UserRound className='h-3 w-3 text-white/40' aria-hidden='true' />
                                        )}
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
                            {showStoredImages ? t('Hide stored images') : t('Show stored images')}
                        </button>
                        {showStoredImages && onRefreshImageAssets && (
                            <button
                                type='button'
                                onClick={onRefreshImageAssets}
                                disabled={disabled || isLoadingImageAssets}
                                className='rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                {isLoadingImageAssets ? t('Loading') : t('Refresh')}
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
                                        alt={asset.name ?? t('Stored image')}
                                        loading='lazy'
                                        className='h-full w-full object-cover'
                                    />
                                    <span className='absolute inset-x-0 bottom-0 truncate bg-[var(--studio-media-overlay)] px-1 py-0.5 text-[10px] text-[var(--studio-media-muted)]'>
                                        {asset.name ?? t('Image')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : showStoredImages ? (
                        <p className='text-xs text-white/45'>
                            {isLoadingImageAssets ? t('Loading stored images') : t('No stored image assets found')}
                        </p>
                    ) : null}
                </div>
            )}

            {showAssetLibrary && remaining > 0 && (attachablePortraits.length > 0 || onOpenAssets) && (
                <div className='space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm text-white/80'>{t('Asset library<colon>')}</span>
                        <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
                            {attachablePortraits.map((portrait) => (
                                <button
                                    key={portrait.assetId}
                                    type='button'
                                    title={t('Attach <lcur>name<rcur>', { name: portrait.name })}
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
                                        {portrait.groupType === 'AIGC' ? t('Virtual') : t('Verified')}
                                    </span>
                                </button>
                            ))}
                            {attachablePortraits.length === 0 && (
                                <span className='text-xs text-white/45'>
                                    {t('No verified or virtual character assets are ready')}
                                </span>
                            )}
                            {onOpenAssets && (
                                <button
                                    type='button'
                                    onClick={() => onOpenAssets()}
                                    disabled={disabled}
                                    className='rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'>
                                    {t('Open Assets')}
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
                    onUpload={onUpload ? uploadReference : undefined}
                    declaration={declarationForUrl(declarations, lastFrameUrl)}
                    reviewStatus={portraitsBySource.get(refKey(lastFrameUrl))?.status}
                    approvedAuthorizationIds={approvedAuthorizationIds}
                    disabled={disabled}
                />
            )}

            {unresolvedDeclarations.length > 0 && (
                <div className='space-y-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3'>
                    <p className='text-sm text-white'>{t('Needs review')}</p>
                    <div className='space-y-2'>
                        {unresolvedDeclarations.map((item) => {
                            const declaration = declarationForUrl(declarations, item.url);
                            const actionLabel = declaration?.origin
                                ? referenceCopy.actionLabel(declaration.origin)
                                : null;
                            const reviewOrigin = automaticReviewOrigin(declaration);
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
                                Boolean(
                                    reviewOrigin || (declaration && originRequiresAssetLibrary(declaration.origin))
                                );
                            const canSwitchToAssetModel = assetLibraryUnsupported && Boolean(onSwitchToAssetModel);
                            const canOpenAssets =
                                Boolean(onOpenAssets) &&
                                Boolean(declaration && originRequiresAssetLibrary(declaration.origin)) &&
                                (!assetLibraryUnsupported || canSwitchToAssetModel);
                            const referenceKey = refKey(item.url);
                            const canReviewInline = Boolean(onReviewReferenceAsset) && Boolean(reviewOrigin);
                            const reviewUnavailable = Boolean(reviewOrigin) && !onReviewReferenceAsset;
                            const reviewAsset = portraitsBySource.get(referenceKey);
                            const referencedAssetId = assetIdFromReferenceUrl(item.url);
                            const referencePreviewUrl =
                                (referencedAssetId ? portraitsByAssetId.get(referencedAssetId)?.thumbUrl : undefined) ??
                                reviewAsset?.thumbUrl;
                            const originHint = reviewUnavailable
                                ? referenceCopy.translateMessage(
                                      'Provider asset review is not configured on this deployment. Ask an admin to enable Assets.'
                                  )
                                : reviewOrigin && assetLibraryUnsupported
                                  ? t(
                                        'Submit the review here<dot> After approval<comma> Studio selects a compatible model and uses the Asset ID automatically'
                                    )
                                  : assetLibraryUnsupported
                                    ? referenceCopy.translateMessage(ASSET_LIBRARY_MODEL_BLOCK_REASON)
                                    : declaration?.origin
                                      ? referenceCopy.originHint(declaration.origin)
                                      : reviewOrigin
                                        ? referenceCopy.originHint(reviewOrigin)
                                        : '';
                            const displayLabel =
                                item.label === 'Last frame'
                                    ? t('Last frame')
                                    : t('Image <lcur>number<rcur>', { number: Number(item.label.split(' ')[1]) });
                            return (
                                <div
                                    key={`${item.label}-${item.url}`}
                                    className='space-y-3 rounded-md border border-white/10 bg-black/40 p-3'>
                                    <div className='flex min-w-0 items-center gap-2'>
                                        <ReferencePreview
                                            url={item.url}
                                            previewUrl={referencePreviewUrl}
                                            alt={t('<lcur>label<rcur> declaration', { label: displayLabel })}
                                            className='h-8 w-8'
                                        />
                                        <span className='min-w-0 text-xs text-white/50'>{displayLabel}</span>
                                    </div>
                                    {(declaration?.origin || reviewOrigin) && (
                                        <div className='space-y-3 text-xs text-amber-100/80'>
                                            <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                                                <span className='min-w-0 leading-5'>{originHint}</span>
                                                {actionLabel && !canReviewInline && (
                                                    <button
                                                        type='button'
                                                        title={
                                                            canOpenAssets
                                                                ? t('Open Assets')
                                                                : assetLibraryUnsupported
                                                                  ? t('Switch model and open Assets')
                                                                  : t('Open Assets')
                                                        }
                                                        onClick={() => {
                                                            if (!canOpenAssets) return;
                                                            if (assetLibraryUnsupported) {
                                                                onSwitchToAssetModel?.();
                                                            }
                                                            onOpenAssets?.(
                                                                declaration?.origin === 'real-person'
                                                                    ? {
                                                                          origin: 'real-person',
                                                                          referenceKey,
                                                                          requestedAt: Date.now(),
                                                                          sourceUrl: item.url
                                                                      }
                                                                    : undefined
                                                            );
                                                        }}
                                                        disabled={!canOpenAssets || disabled}
                                                        className='shrink-0 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/40'>
                                                        {assetLibraryUnsupported ? t('Switch and set up') : actionLabel}
                                                    </button>
                                                )}
                                            </div>
                                            {!assetLibraryUnsupported && mappingOptions.length > 0 && (
                                                <div className='flex flex-wrap items-center gap-1.5'>
                                                    <span className='mr-1 text-white/45'>
                                                        {t('Map to existing<colon>')}
                                                    </span>
                                                    {mappingOptions.map((portrait) => {
                                                        const assetUrl = portraitReferenceUrl(portrait.assetId);
                                                        const selected = urls.includes(assetUrl);
                                                        return (
                                                            <button
                                                                key={portrait.assetId}
                                                                type='button'
                                                                title={t('Use <lcur>name<rcur>', {
                                                                    name: portrait.name
                                                                })}
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
                                                                <span className='max-w-32 truncate'>
                                                                    {portrait.name}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {canReviewInline && reviewOrigin && onReviewReferenceAsset && (
                                                <ReviewAction
                                                    url={item.url}
                                                    label={displayLabel}
                                                    name={uploadedNames[referenceKey] || reviewAsset?.name}
                                                    origin={reviewOrigin}
                                                    asset={reviewAsset}
                                                    autoSubmit={
                                                        reviewOrigin === 'uploaded' ||
                                                        reviewOrigin === 'no-person' ||
                                                        reviewOrigin === 'thirdparty-ai'
                                                    }
                                                    disabled={disabled}
                                                    onReview={onReviewReferenceAsset}
                                                    onApproved={() => {
                                                        if (assetLibraryUnsupported) {
                                                            onSwitchToAssetModel?.();
                                                        }
                                                    }}
                                                />
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
                                    <p className='text-xs text-white/60'>{t('Uploading<hellip>')}</p>
                                </>
                            ) : (
                                <>
                                    <ImagePlus className='h-5 w-5 text-white/50' />
                                    <p className='text-xs text-white/60'>
                                        {urls.length
                                            ? t('Add another image')
                                            : t('Drop an image here or click to upload')}
                                    </p>
                                    <p className='text-[10px] text-white/35'>
                                        PNG · JPEG · WebP · 300-6000 px per side · up to 10 MB
                                    </p>
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
                            {t('Use an image URL instead')}
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
                                {t('Add')}
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
