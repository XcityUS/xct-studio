'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link2, Loader2, Video, X } from 'lucide-react';
import * as React from 'react';

interface ReferenceVideosInputProps {
    /** Public video URLs, in order — [Video 1], [Video 2], … in the prompt. */
    urls: string[];
    onChange: (urls: string[]) => void;
    /** Uploads a local file and resolves to its public URL. Absent = URL-only mode. */
    onUpload?: (file: File) => Promise<string>;
    disabled?: boolean;
}

const MAX_REFERENCE_VIDEOS = 2;

function isHttpVideoUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function ReferenceVideosInput({ urls, onChange, onUpload, disabled }: ReferenceVideosInputProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [urlDraft, setUrlDraft] = React.useState('');

    const remaining = MAX_REFERENCE_VIDEOS - urls.length;
    const canUpload = Boolean(onUpload);

    const addUrls = React.useCallback(
        (added: string[]) => {
            const cleaned = added.map((u) => u.trim()).filter(isHttpVideoUrl);
            if (!cleaned.length) {
                setUploadError('Enter a valid http(s) video URL.');
                return;
            }
            const next = [...urls, ...cleaned.filter((u) => !urls.includes(u))].slice(0, MAX_REFERENCE_VIDEOS);
            onChange(next);
            setUploadError(null);
        },
        [urls, onChange]
    );

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

    return (
        <div className='space-y-2'>
            <Label className='text-white'>Reference Videos (Optional)</Label>

            {urls.length > 0 && (
                <div className='grid gap-2 sm:grid-cols-2'>
                    {urls.map((url, i) => (
                        <div key={`${url}-${i}`} className='rounded-md border border-white/10 bg-white/[0.03] p-2'>
                            <div className='relative overflow-hidden rounded-md border border-white/15 bg-black'>
                                <video
                                    src={url}
                                    controls
                                    preload='metadata'
                                    className='aspect-video w-full object-contain'
                                    title={url}
                                />
                                <span className='pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/80'>
                                    Video {i + 1}
                                </span>
                                <button
                                    type='button'
                                    onClick={() => removeAt(i)}
                                    disabled={disabled}
                                    className='absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded bg-black/70 text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                                    aria-label={`Remove reference video ${i + 1}`}>
                                    <X className='h-3.5 w-3.5' />
                                </button>
                            </div>
                        </div>
                    ))}
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
                                    <Video className='h-5 w-5 text-white/50' />
                                    <p className='text-xs text-white/60'>
                                        {urls.length ? 'Add another video' : 'Drop video here or click to upload'}
                                    </p>
                                    <p className='text-[10px] text-white/35'>MP4 / MOV / WebM / up to 20 MB</p>
                                </>
                            )}
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='video/mp4,video/quicktime,video/webm'
                        multiple
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
                            Use a video URL instead
                        </button>
                    ) : (
                        <div className='flex gap-2'>
                            <Input
                                type='url'
                                placeholder='https://…/video.mp4'
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
            <p className='text-xs text-white/40'>
                Cite as [Video 1] in your prompt — camera/style imitation, targeted edits, or transitions. Up to 20 MB
                each.
            </p>
        </div>
    );
}
