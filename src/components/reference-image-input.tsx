'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
import * as React from 'react';

interface ReferenceImageInputProps {
    /** The public image URL sent to the gateway (single source of truth). */
    value: string;
    onChange: (url: string) => void;
    /** Uploads a local file and resolves to its public URL. Absent = URL-only mode. */
    onUpload?: (file: File) => Promise<string>;
    disabled?: boolean;
    label?: string;
    /** Explains what the frame does for this slot (first frame vs last frame). */
    hint?: string;
}

/**
 * Image-to-video reference picker: drop/click to upload a local image (stored
 * via the media worker, which hands back a public URL the gateway can fetch),
 * or paste a URL directly. Shows a preview of whichever the form will send.
 */
export function ReferenceImageInput({
    value,
    onChange,
    onUpload,
    disabled,
    label = 'Reference Image (Optional)',
    hint = 'The video starts from this frame, guided by your prompt.'
}: ReferenceImageInputProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);

    const handleFile = React.useCallback(
        async (file: File | undefined | null) => {
            if (!file || !onUpload || disabled) return;
            setIsUploading(true);
            setUploadError(null);
            try {
                const url = await onUpload(file);
                onChange(url);
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Upload failed.');
            } finally {
                setIsUploading(false);
            }
        },
        [onUpload, onChange, disabled]
    );

    const canUpload = Boolean(onUpload);

    return (
        <div className='space-y-2'>
            <Label className='text-white'>{label}</Label>

            {value ? (
                <div className='flex items-center gap-3 rounded-md border border-white/20 bg-white/5 p-2'>
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external/worker URL, not a static asset */}
                    <img
                        src={value}
                        alt='Reference preview'
                        className='h-16 w-16 shrink-0 rounded object-cover'
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = 'hidden';
                        }}
                    />
                    <p className='min-w-0 flex-1 truncate text-xs text-white/50' title={value}>
                        {value}
                    </p>
                    <button
                        type='button'
                        onClick={() => {
                            onChange('');
                            setUploadError(null);
                        }}
                        disabled={disabled}
                        className='shrink-0 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white'
                        aria-label='Remove reference image'>
                        <X className='h-4 w-4' />
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
                                void handleFile(e.dataTransfer.files?.[0]);
                            }}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-5 text-center transition-colors',
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
                                    <p className='text-xs text-white/60'>Drop an image here or click to upload</p>
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
                            void handleFile(e.target.files?.[0]);
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
                        <Input
                            type='url'
                            placeholder='https://…/image.png'
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            disabled={disabled}
                            className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    )}
                </>
            )}

            {uploadError && <p className='text-xs text-red-400'>{uploadError}</p>}
            <p className='text-xs text-white/40'>{hint}</p>
        </div>
    );
}
