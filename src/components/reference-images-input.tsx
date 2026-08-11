'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
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

type LastFrameSlotProps = {
    url: string;
    onChange: (url: string) => void;
    onUpload?: (file: File) => Promise<string>;
    disabled?: boolean;
};

function LastFrameSlot({ url, onChange, onUpload, disabled }: LastFrameSlotProps) {
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary worker/external URL */}
                    <img
                        src={url}
                        alt='Last frame reference'
                        title={url}
                        className='h-full w-full object-cover'
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = 'hidden';
                        }}
                    />
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

    const addUrls = React.useCallback(
        (added: string[]) => {
            const cleaned = added
                .map((u) => u.trim())
                .filter(isHttpImageUrl);
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
                            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary worker/external URL */}
                            <img
                                src={url}
                                alt={`Reference ${i + 1}`}
                                title={url}
                                className='h-full w-full object-cover'
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.visibility = 'hidden';
                                }}
                            />
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
                        </div>
                    ))}
                </div>
            )}

            {urls.length === 1 && onLastFrameChange && (
                <LastFrameSlot
                    url={lastFrameUrl}
                    onChange={onLastFrameChange}
                    onUpload={onUpload}
                    disabled={disabled}
                />
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
                                placeholder='https://…/image.png'
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
