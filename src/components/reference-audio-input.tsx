'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ttsModel as loadTtsModel } from '@/lib/media-archive';
import type { TtsVoice } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { Link2, Loader2, Mic2, Music, X } from 'lucide-react';
import * as React from 'react';

interface ReferenceAudioInputProps {
    url: string;
    onChange: (url: string) => void;
    /** Uploads a local file and resolves to its public URL. Absent = URL-only mode. */
    onUpload?: (file: File) => Promise<string>;
    /** Generates speech, uploads it, and resolves to its public URL. */
    onSynthesizeSpeech?: (text: string, voice: TtsVoice) => Promise<string>;
    disabled?: boolean;
}

const TTS_VOICES: TtsVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

function isHttpAudioUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function ReferenceAudioInput({
    url,
    onChange,
    onUpload,
    onSynthesizeSpeech,
    disabled
}: ReferenceAudioInputProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [showUrlInput, setShowUrlInput] = React.useState(false);
    const [urlDraft, setUrlDraft] = React.useState('');
    const [ttsConfigured, setTtsConfigured] = React.useState(false);
    const [voiceoverText, setVoiceoverText] = React.useState('');
    const [voiceoverVoice, setVoiceoverVoice] = React.useState<TtsVoice>('alloy');
    const [isSynthesizing, setIsSynthesizing] = React.useState(false);
    const [voiceoverError, setVoiceoverError] = React.useState<string | null>(null);

    const canUpload = Boolean(onUpload);
    const canSynthesize = ttsConfigured && Boolean(onSynthesizeSpeech);

    React.useEffect(() => {
        let cancelled = false;

        void loadTtsModel().then((model) => {
            if (!cancelled) {
                setTtsConfigured(Boolean(model));
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const commitDraft = React.useCallback(
        (value?: string) => {
            const draft = (value ?? urlDraft).trim();
            if (!draft) return;
            if (!isHttpAudioUrl(draft)) {
                setUploadError('Enter a valid http(s) audio URL.');
                return;
            }
            onChange(draft);
            setUrlDraft('');
            setUploadError(null);
            setVoiceoverError(null);
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
                setVoiceoverError(null);
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Upload failed.');
            } finally {
                setIsUploading(false);
            }
        },
        [onUpload, disabled, onChange]
    );

    const handleGenerateVoiceover = React.useCallback(async () => {
        if (!onSynthesizeSpeech || disabled || isSynthesizing) return;

        const text = voiceoverText.trim();
        if (!text) {
            setVoiceoverError('Enter voiceover text.');
            return;
        }

        setIsSynthesizing(true);
        setVoiceoverError(null);
        setUploadError(null);

        try {
            onChange(await onSynthesizeSpeech(text, voiceoverVoice));
            setVoiceoverText('');
        } catch (err) {
            setVoiceoverError(err instanceof Error ? err.message : 'Voiceover generation failed.');
        } finally {
            setIsSynthesizing(false);
        }
    }, [disabled, isSynthesizing, onChange, onSynthesizeSpeech, voiceoverText, voiceoverVoice]);

    return (
        <div className='space-y-2'>
            <Label className='text-white'>Background audio (optional)</Label>

            {url ? (
                <div className='rounded-md border border-white/10 bg-white/[0.03] p-3'>
                    <div className='flex items-center gap-3'>
                        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-black text-white/60'>
                            <Music className='h-4 w-4' />
                        </div>
                        <audio src={url} controls preload='none' className='min-w-0 flex-1' title={url} />
                        <button
                            type='button'
                            onClick={() => {
                                onChange('');
                                setUploadError(null);
                                setVoiceoverError(null);
                            }}
                            disabled={disabled}
                            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                            aria-label='Remove background audio'>
                            <X className='h-4 w-4' />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {canUpload && (
                        <div
                            role='button'
                            tabIndex={disabled || isSynthesizing ? -1 : 0}
                            onClick={() =>
                                !disabled && !isUploading && !isSynthesizing && fileInputRef.current?.click()
                            }
                            onKeyDown={(e) => {
                                if (
                                    (e.key === 'Enter' || e.key === ' ') &&
                                    !disabled &&
                                    !isUploading &&
                                    !isSynthesizing
                                ) {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                if (!disabled && !isSynthesizing) setIsDragOver(true);
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
                                (disabled || isUploading || isSynthesizing) && 'pointer-events-none opacity-50'
                            )}>
                            {isUploading ? (
                                <>
                                    <Loader2 className='h-5 w-5 animate-spin text-white/60' />
                                    <p className='text-xs text-white/60'>Uploading…</p>
                                </>
                            ) : (
                                <>
                                    <Music className='h-5 w-5 text-white/50' />
                                    <p className='text-xs text-white/60'>
                                        Drop audio here or click to upload
                                    </p>
                                    <p className='text-[10px] text-white/35'>MP3 · WAV · M4A · up to 15 MB</p>
                                </>
                            )}
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type='file'
                        accept='audio/mpeg,audio/wav,audio/mp4,audio/x-m4a'
                        className='hidden'
                        onChange={(e) => {
                            void handleFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />

                    {canSynthesize && (
                        <div className='rounded-md border border-white/10 bg-white/[0.03] p-3'>
                            <div className='mb-2 flex items-center gap-2'>
                                <Mic2 className='h-4 w-4 text-white/55' />
                                <Label htmlFor='voiceover-text' className='text-xs font-medium text-white/70'>
                                    Generate voiceover
                                </Label>
                            </div>
                            <Textarea
                                id='voiceover-text'
                                value={voiceoverText}
                                maxLength={500}
                                rows={3}
                                onChange={(event) => setVoiceoverText(event.target.value)}
                                disabled={disabled || isSynthesizing}
                                placeholder='Voiceover text'
                                className='min-h-20 resize-none rounded-md border-white/15 bg-black/40 text-sm text-white placeholder:text-white/35 focus-visible:border-white/40 focus-visible:ring-white/20'
                            />
                            <div className='mt-2 flex flex-col gap-2 sm:flex-row'>
                                <Select
                                    value={voiceoverVoice}
                                    onValueChange={(value) => setVoiceoverVoice(value as TtsVoice)}
                                    disabled={disabled || isSynthesizing}>
                                    <SelectTrigger className='h-9 border-white/15 bg-black/40 text-white focus:ring-white/20 sm:w-36'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className='border-white/15 bg-neutral-950 text-white'>
                                        {TTS_VOICES.map((voice) => (
                                            <SelectItem key={voice} value={voice}>
                                                {voice}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <button
                                    type='button'
                                    onClick={() => void handleGenerateVoiceover()}
                                    disabled={disabled || isSynthesizing || !voiceoverText.trim()}
                                    className='inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/20 px-3 text-xs text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                    {isSynthesizing ? (
                                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                    ) : (
                                        <Mic2 className='h-3.5 w-3.5' />
                                    )}
                                    Generate
                                </button>
                            </div>
                            <div className='mt-1 flex items-center justify-between gap-3 text-[10px] text-white/35'>
                                <span>{voiceoverText.length}/500</span>
                                {isSynthesizing && <span>Generating...</span>}
                            </div>
                            {voiceoverError && <p className='mt-2 text-xs text-red-400'>{voiceoverError}</p>}
                        </div>
                    )}

                    {canUpload && !showUrlInput ? (
                        <button
                            type='button'
                            onClick={() => setShowUrlInput(true)}
                            disabled={disabled}
                            className='flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70'>
                            <Link2 className='h-3 w-3' />
                            Use an audio URL instead
                        </button>
                    ) : (
                        <div className='flex gap-2'>
                            <Input
                                type='url'
                                placeholder='https://…/audio.mp3'
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
                Prompt can reference it as [Audio 1], for example: use [Audio 1] as background music.
            </p>
        </div>
    );
}
