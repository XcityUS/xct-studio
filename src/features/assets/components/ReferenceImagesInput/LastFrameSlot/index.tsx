'use client';

import { ReferencePreview } from '../ReferencePreview';
import { ReferenceStatusBadge } from '../ReferenceStatusBadge';
import { isHttpImageUrl } from '../utils';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { type ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoPortraitStatus } from '@/features/generation/history/merge';
import { cn } from '@/shared/utils/classnames';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export type LastFrameSlotProps = {
    url: string;
    onChange: (url: string) => void;
    onUpload?: (file: File) => Promise<string>;
    declaration?: ReferenceDeclaration;
    reviewStatus?: VideoPortraitStatus;
    approvedAuthorizationIds: ReadonlySet<string>;
    disabled?: boolean;
};

export function LastFrameSlot({
    url,
    onChange,
    onUpload,
    declaration,
    reviewStatus,
    approvedAuthorizationIds,
    disabled
}: LastFrameSlotProps) {
    const t = useTranslations();
    const invalidUrlMessage = t('Enter a valid http<lpar>s<rpar> image URL');
    const uploadFailedMessage = t('Upload failed');
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
                setUploadError(invalidUrlMessage);
                return;
            }
            onChange(draft);
            setUrlDraft('');
            setUploadError(null);
        },
        [invalidUrlMessage, onChange, urlDraft]
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
                setUploadError(err instanceof Error ? err.message : uploadFailedMessage);
            } finally {
                setIsUploading(false);
            }
        },
        [disabled, onChange, onUpload, uploadFailedMessage]
    );

    return (
        <div className='space-y-2 rounded-md border border-white/10 bg-white/[0.03] p-3'>
            <Label className='text-xs text-white/70'>{t('Last frame <lpar>optional<rpar>')}</Label>

            {url ? (
                <div className='relative h-16 w-16 overflow-hidden rounded-md border border-white/20 bg-white/5'>
                    <ReferencePreview url={url} alt={t('Last frame reference')} className='h-full w-full border-0' />
                    <span className='absolute bottom-0 left-0 rounded-tr bg-[var(--studio-media-overlay)] px-1 text-[10px] text-[var(--studio-media-muted)]'>
                        {t('last')}
                    </span>
                    <button
                        type='button'
                        onClick={() => {
                            onChange('');
                            setUploadError(null);
                        }}
                        disabled={disabled}
                        className='absolute top-0 right-0 rounded-bl bg-[var(--studio-media-overlay)] p-0.5 text-[var(--studio-media-muted)] transition-colors hover:text-[var(--studio-media-foreground)]'
                        aria-label={t('Remove last frame')}>
                        <X className='h-3 w-3' />
                    </button>
                    <ReferenceStatusBadge
                        declaration={declaration}
                        approvedAuthorizationIds={approvedAuthorizationIds}
                        reviewStatus={reviewStatus}
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
                                    <p className='text-xs text-white/60'>{t('Uploading<hellip>')}</p>
                                </>
                            ) : (
                                <>
                                    <ImagePlus className='h-5 w-5 text-white/50' />
                                    <p className='text-xs text-white/60'>
                                        {t('Drop the final frame here or click to upload')}
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
                                {t('Add')}
                            </button>
                        </div>
                    )}
                </>
            )}

            {uploadError && <p className='text-xs text-red-400'>{uploadError}</p>}
        </div>
    );
}
