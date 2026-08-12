'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CaptionBurnUnavailableError, assembleClips, type AssembleClip, type AssembleOptions } from '@/lib/assemble';
import { segmentsToSrt, type CaptionSegment } from '@/lib/captions';
import { transcribeModel as loadTranscribeModel, type UserAsset } from '@/lib/media-archive';
import { buildFcp7Xml, type Fcp7XmlClip } from '@/lib/nle-export';
import { parseSize, pixelDimensions, type VideoRatio } from '@/lib/seedance';
import { getVideoDuration } from '@/lib/thumbnail';
import { cn } from '@/lib/utils';
import type { VideoMetadata } from '@/types/video';
import { ArrowDown, ArrowUp, Captions, Crop, Download, FileCode2, Loader2, Music, Trash2 } from 'lucide-react';
import * as React from 'react';

const NONE_BGM_VALUE = '__none__';
const DEFAULT_BGM_VOLUME = 60;
const TIME_EPSILON = 0.001;
const ORIGINAL_EXPORT_FORMAT = 'original';
const CLOUD_XML_TOOLTIP = 'Archive to cloud first — XML references cloud URLs';

type ExportFormatId = 'original' | 'vertical' | 'square' | 'widescreen';

type ExportFormatOption = {
    id: ExportFormatId;
    label: string;
    ratio?: VideoRatio;
    reframe?: {
        width: number;
        height: number;
    };
};

const EXPORT_FORMATS = [
    { id: ORIGINAL_EXPORT_FORMAT, label: 'Original' },
    { id: 'vertical', label: 'TikTok / Reels · 9:16', ratio: '9:16', reframe: { width: 1080, height: 1920 } },
    { id: 'square', label: 'Square · 1:1', ratio: '1:1', reframe: { width: 1080, height: 1080 } },
    { id: 'widescreen', label: 'Widescreen · 16:9', ratio: '16:9', reframe: { width: 1920, height: 1080 } }
] as const satisfies readonly ExportFormatOption[];

type AssemblyEditorProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: VideoMetadata[];
    resolveClipBlob: (item: VideoMetadata) => Promise<Blob>;
    loadAudioAssets?: () => Promise<UserAsset[]>;
    onTranscribeVideo?: (blob: Blob) => Promise<CaptionSegment[]>;
};

type ClipRow = {
    id: string;
    item: VideoMetadata;
    blob?: Blob;
    duration?: number;
    inValue: string;
    outValue: string;
    error?: string;
};

type ClipValidation = {
    inTime: number;
    outTime: number;
    error?: string;
};

function formatSeconds(value: number) {
    if (!Number.isFinite(value)) return '0s';
    return `${Number(value.toFixed(1)).toString()}s`;
}

function formatTimeInput(value: number) {
    if (!Number.isFinite(value)) return '';
    return Number(value.toFixed(3)).toString();
}

function parseSeconds(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    return Number(trimmed);
}

function displayNameForClip(item: VideoMetadata) {
    return item.filename || `${item.id}.mp4`;
}

function displayNameForAsset(asset: UserAsset) {
    const assetName = asset.name?.trim();
    if (assetName) return assetName;
    return asset.key.split('/').pop()?.trim() || 'Untitled audio';
}

function extensionFromPath(value: string | null | undefined) {
    if (!value) return undefined;
    const clean = value.split(/[?#]/)[0];
    const match = /\.([a-z0-9]{1,8})$/i.exec(clean);
    return match?.[1]?.toLowerCase();
}

function extensionFromMime(mimeType: string) {
    const normalized = mimeType.toLowerCase().split(';')[0].trim();
    const byMime: Record<string, string> = {
        'audio/aac': 'aac',
        'audio/flac': 'flac',
        'audio/m4a': 'm4a',
        'audio/mp3': 'mp3',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/webm': 'webm',
        'audio/x-m4a': 'm4a',
        'audio/x-wav': 'wav'
    };

    return byMime[normalized];
}

function mimeFromExtension(extension: string) {
    const byExtension: Record<string, string> = {
        aac: 'audio/aac',
        flac: 'audio/flac',
        m4a: 'audio/mp4',
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        wav: 'audio/wav',
        webm: 'audio/webm'
    };

    return byExtension[extension];
}

function extensionForAsset(asset: UserAsset, mimeType: string) {
    return extensionFromPath(asset.key) ?? extensionFromPath(asset.name) ?? extensionFromMime(mimeType) ?? 'mp3';
}

function validateClip(row: ClipRow): ClipValidation {
    if (row.error) return { inTime: 0, outTime: 0, error: row.error };
    if (!row.blob || typeof row.duration !== 'number') {
        return { inTime: 0, outTime: 0, error: 'Loading clip metadata.' };
    }

    const inTime = parseSeconds(row.inValue);
    const outTime = parseSeconds(row.outValue);

    if (!Number.isFinite(inTime) || !Number.isFinite(outTime)) {
        return { inTime: 0, outTime: 0, error: 'Enter numeric trim times.' };
    }

    if (inTime < 0) {
        return { inTime, outTime, error: 'In must be 0 or greater.' };
    }

    if (outTime <= inTime) {
        return { inTime, outTime, error: 'Out must be greater than In.' };
    }

    if (outTime - row.duration > TIME_EPSILON) {
        return { inTime, outTime, error: `Out must be ${formatSeconds(row.duration)} or less.` };
    }

    return { inTime, outTime };
}

async function fetchBgmBlob(asset: UserAsset): Promise<Blob> {
    const response = await fetch(asset.url);
    if (!response.ok) {
        throw new Error(`Could not load ${displayNameForAsset(asset)} (${response.status}).`);
    }

    const blob = await response.blob();
    const extension = extensionForAsset(asset, blob.type);
    const type = blob.type || mimeFromExtension(extension) || 'audio/mpeg';

    if (typeof File === 'undefined') {
        return new Blob([blob], { type });
    }

    return new File([blob], `bgm.${extension}`, { type });
}

function timestampForFilename() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function exportBaseName() {
    return `assembled-${timestampForFilename()}`;
}

function timelineFileName() {
    return `timeline-${timestampForFilename()}.xml`;
}

function exportFormatById(id: ExportFormatId): ExportFormatOption {
    return EXPORT_FORMATS.find((format) => format.id === id) ?? EXPORT_FORMATS[0];
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    try {
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
    } finally {
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

function downloadSrt(srt: string, filename: string) {
    downloadBlob(new Blob([srt], { type: 'application/x-subrip;charset=utf-8' }), filename);
}

function downloadXml(xml: string, filename: string) {
    downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), filename);
}

function usesDefaultTrim(validation: ClipValidation, duration: number) {
    return Math.abs(validation.inTime) <= TIME_EPSILON && Math.abs(validation.outTime - duration) <= TIME_EPSILON;
}

export function AssemblyEditor({
    open,
    onOpenChange,
    items,
    resolveClipBlob,
    loadAudioAssets,
    onTranscribeVideo
}: AssemblyEditorProps) {
    const [rows, setRows] = React.useState<ClipRow[]>([]);
    const [isLoadingClips, setIsLoadingClips] = React.useState(false);
    const [audioAssets, setAudioAssets] = React.useState<UserAsset[]>([]);
    const [audioError, setAudioError] = React.useState<string | null>(null);
    const [isLoadingAudio, setIsLoadingAudio] = React.useState(false);
    const [selectedBgmKey, setSelectedBgmKey] = React.useState(NONE_BGM_VALUE);
    const [bgmVolume, setBgmVolume] = React.useState(DEFAULT_BGM_VOLUME);
    const [isExporting, setIsExporting] = React.useState(false);
    const [exportProgress, setExportProgress] = React.useState<number | null>(null);
    const [exportError, setExportError] = React.useState<string | null>(null);
    const [exportNotice, setExportNotice] = React.useState<string | null>(null);
    const [captionsConfigured, setCaptionsConfigured] = React.useState(false);
    const [burnCaptions, setBurnCaptions] = React.useState(false);
    const [downloadSrtOnly, setDownloadSrtOnly] = React.useState(false);
    const [exportFormat, setExportFormat] = React.useState<ExportFormatId>(ORIGINAL_EXPORT_FORMAT);

    React.useEffect(() => {
        if (!open) {
            setRows([]);
            setAudioAssets([]);
            setAudioError(null);
            setSelectedBgmKey(NONE_BGM_VALUE);
            setBgmVolume(DEFAULT_BGM_VOLUME);
            setExportProgress(null);
            setExportError(null);
            setExportNotice(null);
            setCaptionsConfigured(false);
            setBurnCaptions(false);
            setDownloadSrtOnly(false);
            setExportFormat(ORIGINAL_EXPORT_FORMAT);
            return;
        }

        let cancelled = false;
        setIsLoadingClips(true);
        setExportProgress(null);
        setExportError(null);
        setExportNotice(null);
        setRows(
            items.map((item) => ({
                id: item.id,
                item,
                inValue: '0',
                outValue: '',
                error: undefined
            }))
        );

        void Promise.all(
            items.map(async (item): Promise<ClipRow> => {
                try {
                    const blob = await resolveClipBlob(item);
                    const duration = await getVideoDuration(blob);

                    if (!Number.isFinite(duration) || duration <= 0) {
                        throw new Error('Could not read clip duration.');
                    }

                    return {
                        id: item.id,
                        item,
                        blob,
                        duration,
                        inValue: '0',
                        outValue: formatTimeInput(duration)
                    };
                } catch (err) {
                    return {
                        id: item.id,
                        item,
                        inValue: '0',
                        outValue: '',
                        error: err instanceof Error ? err.message : 'Could not load clip.'
                    };
                }
            })
        )
            .then((nextRows) => {
                if (!cancelled) {
                    setRows(nextRows);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingClips(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [items, open, resolveClipBlob]);

    React.useEffect(() => {
        if (!open) return;

        let cancelled = false;
        void loadTranscribeModel().then((model) => {
            if (!cancelled) {
                const configured = Boolean(model);
                setCaptionsConfigured(configured);
                if (!configured) {
                    setBurnCaptions(false);
                    setDownloadSrtOnly(false);
                }
            }
        });

        return () => {
            cancelled = true;
        };
    }, [open]);

    React.useEffect(() => {
        if (!open || !loadAudioAssets) return;

        let cancelled = false;
        setIsLoadingAudio(true);
        setAudioError(null);

        void loadAudioAssets()
            .then((assets) => {
                if (!cancelled) {
                    setAudioAssets(assets.filter((asset) => asset.kind === 'audio'));
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setAudioAssets([]);
                    setAudioError(err instanceof Error ? err.message : 'Could not load audio assets.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingAudio(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [loadAudioAssets, open]);

    React.useEffect(() => {
        if (selectedBgmKey === NONE_BGM_VALUE) return;
        if (!audioAssets.some((asset) => asset.key === selectedBgmKey)) {
            setSelectedBgmKey(NONE_BGM_VALUE);
        }
    }, [audioAssets, selectedBgmKey]);

    const validations = React.useMemo(() => {
        return new Map(rows.map((row) => [row.id, validateClip(row)]));
    }, [rows]);

    const firstClipError = React.useMemo(() => {
        if (rows.length < 2) return 'Keep at least two clips in the assembly.';
        for (const row of rows) {
            const validation = validations.get(row.id);
            if (validation?.error) return validation.error;
        }
        return null;
    }, [rows, validations]);

    const totalRuntime = React.useMemo(() => {
        return rows.reduce((total, row) => {
            const validation = validations.get(row.id);
            if (!validation || validation.error) return total;
            return total + validation.outTime - validation.inTime;
        }, 0);
    }, [rows, validations]);

    const selectedBgmAsset = React.useMemo(() => {
        if (selectedBgmKey === NONE_BGM_VALUE) return undefined;
        return audioAssets.find((asset) => asset.key === selectedBgmKey);
    }, [audioAssets, selectedBgmKey]);

    const selectedExportFormat = React.useMemo(() => exportFormatById(exportFormat), [exportFormat]);
    const parsedSourceSize = React.useMemo(() => {
        const size = rows[0]?.item.size ?? items[0]?.size ?? '';
        return parseSize(size);
    }, [items, rows]);
    const selectedReframe = React.useMemo(() => {
        if (!selectedExportFormat.reframe) return undefined;
        if (parsedSourceSize?.ratio && selectedExportFormat.ratio === parsedSourceSize.ratio) return undefined;

        return {
            width: selectedExportFormat.reframe.width,
            height: selectedExportFormat.reframe.height
        };
    }, [parsedSourceSize, selectedExportFormat]);
    const allRowsHaveCloudUrls = rows.length > 0 && rows.every((row) => Boolean(row.item.storedUrl));
    const captionsAvailable = captionsConfigured && Boolean(onTranscribeVideo);
    const canExport = !isLoadingClips && !isExporting && !firstClipError;
    const canExportTimeline = canExport && allRowsHaveCloudUrls;

    const updateRow = React.useCallback((id: string, updates: Partial<Pick<ClipRow, 'inValue' | 'outValue'>>) => {
        setRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
    }, []);

    const moveRow = React.useCallback((index: number, direction: -1 | 1) => {
        setRows((current) => {
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= current.length) return current;
            const next = [...current];
            const [row] = next.splice(index, 1);
            next.splice(targetIndex, 0, row);
            return next;
        });
    }, []);

    const removeRow = React.useCallback((id: string) => {
        setRows((current) => current.filter((row) => row.id !== id));
    }, []);

    const handleDialogOpenChange = React.useCallback(
        (nextOpen: boolean) => {
            if (isExporting && !nextOpen) return;
            onOpenChange(nextOpen);
        },
        [isExporting, onOpenChange]
    );

    const buildAssemblyClips = React.useCallback((): AssembleClip[] => {
        return rows.map((row) => {
            const validation = validations.get(row.id);
            if (!row.blob || typeof row.duration !== 'number' || !validation || validation.error) {
                throw new Error('Assembly is not ready to export.');
            }

            return {
                id: row.id,
                blob: row.blob,
                ...(usesDefaultTrim(validation, row.duration)
                    ? {}
                    : {
                          inTime: validation.inTime,
                          outTime: validation.outTime
                      })
            };
        });
    }, [rows, validations]);

    const handleExport = React.useCallback(async () => {
        if (!canExport) {
            setExportError(firstClipError || 'Assembly is not ready to export.');
            return;
        }

        setIsExporting(true);
        setExportProgress(0);
        setExportError(null);
        setExportNotice(null);

        try {
            const clips = buildAssemblyClips();
            const bgmBlob = selectedBgmAsset ? await fetchBgmBlob(selectedBgmAsset) : undefined;
            const baseOptions: AssembleOptions | undefined = bgmBlob
                ? {
                      bgm: {
                          blob: bgmBlob,
                          volume: bgmVolume / 100
                      }
                  }
                : undefined;
            const finalOptions: AssembleOptions | undefined = selectedReframe
                ? {
                      ...(baseOptions ?? {}),
                      reframe: selectedReframe
                  }
                : baseOptions;
            const wantsCaptions = captionsAvailable && (burnCaptions || downloadSrtOnly);
            const baseName = exportBaseName();

            if (!wantsCaptions) {
                const output = await assembleClips(clips, finalOptions, setExportProgress);
                downloadBlob(output, `${baseName}.mp4`);
                onOpenChange(false);
                return;
            }

            if (!onTranscribeVideo) {
                throw new Error('Auto-captioning is not configured on this deployment.');
            }

            const transcriptionOutput = await assembleClips(clips, baseOptions, (progress) =>
                setExportProgress(progress * 0.56)
            );

            setExportProgress(0.68);
            const srt = segmentsToSrt(await onTranscribeVideo(transcriptionOutput));
            if (!srt.trim()) {
                throw new Error('No speech was detected for captions.');
            }
            setExportProgress(0.74);

            if (downloadSrtOnly) {
                const output = selectedReframe
                    ? await assembleClips(clips, finalOptions, (progress) => setExportProgress(0.74 + progress * 0.26))
                    : transcriptionOutput;
                downloadBlob(output, `${baseName}.mp4`);
                downloadSrt(srt, `${baseName}.srt`);
                setExportProgress(1);
                onOpenChange(false);
                return;
            }

            try {
                const captionedOutput = await assembleClips(
                    clips,
                    {
                        ...(finalOptions ?? {}),
                        captions: { srt }
                    },
                    (progress) => setExportProgress(0.74 + progress * 0.26)
                );
                downloadBlob(captionedOutput, `${baseName}.mp4`);
                onOpenChange(false);
            } catch (err) {
                if (!(err instanceof CaptionBurnUnavailableError)) {
                    throw err;
                }

                console.warn('Caption burn-in unavailable; exporting SRT sidecar instead.', err);
                const fallbackOutput = selectedReframe
                    ? await assembleClips(clips, finalOptions, (progress) => setExportProgress(0.74 + progress * 0.26))
                    : transcriptionOutput;
                downloadBlob(fallbackOutput, `${baseName}.mp4`);
                downloadSrt(srt, `${baseName}.srt`);
                setExportProgress(1);
                setExportNotice('captions exported as .srt (burn-in unavailable)');
            }
        } catch (err) {
            console.error('Error assembling clips:', err);
            setExportError(err instanceof Error ? err.message : 'Failed to assemble clips.');
        } finally {
            setIsExporting(false);
        }
    }, [
        bgmVolume,
        buildAssemblyClips,
        burnCaptions,
        canExport,
        captionsAvailable,
        downloadSrtOnly,
        firstClipError,
        onOpenChange,
        onTranscribeVideo,
        selectedBgmAsset,
        selectedReframe
    ]);

    const handleTimelineExport = React.useCallback(() => {
        if (!canExportTimeline) {
            setExportError(
                allRowsHaveCloudUrls ? firstClipError || 'Assembly is not ready to export.' : CLOUD_XML_TOOLTIP
            );
            return;
        }

        setExportError(null);
        setExportNotice(null);

        try {
            const parsedSize = parseSize(rows[0]?.item.size ?? '');
            if (!parsedSize) {
                throw new Error('Could not read clip size for XML export.');
            }

            const dimensions = pixelDimensions(parsedSize.ratio, parsedSize.resolution);
            const clips: Fcp7XmlClip[] = rows.map((row) => {
                const validation = validations.get(row.id);
                const url = row.item.storedUrl;

                if (!url || typeof row.duration !== 'number' || !validation || validation.error) {
                    throw new Error('Assembly is not ready to export timeline XML.');
                }

                return {
                    name: displayNameForClip(row.item),
                    url,
                    durationSeconds: row.duration,
                    width: dimensions.width,
                    height: dimensions.height,
                    ...(usesDefaultTrim(validation, row.duration)
                        ? {}
                        : {
                              inSeconds: validation.inTime,
                              outSeconds: validation.outTime
                          })
                };
            });

            downloadXml(buildFcp7Xml(clips), timelineFileName());
            setExportNotice('timeline exported as .xml');
        } catch (err) {
            console.error('Error exporting timeline XML:', err);
            setExportError(err instanceof Error ? err.message : 'Failed to export timeline XML.');
        }
    }, [allRowsHaveCloudUrls, canExportTimeline, firstClipError, rows, validations]);

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                hideCloseButton={isExporting}
                className='max-h-[92vh] gap-0 overflow-hidden border-white/20 bg-neutral-950 p-0 text-white sm:max-w-[880px]'>
                <DialogHeader className='border-b border-white/10 px-5 py-4'>
                    <DialogTitle className='text-white'>Assembly editor</DialogTitle>
                    <DialogDescription className='text-white/55'>
                        Trim, reorder, and add optional background music before export.
                    </DialogDescription>
                </DialogHeader>

                <div className='max-h-[62vh] space-y-4 overflow-y-auto px-5 py-4'>
                    <div className='space-y-2'>
                        <div className='grid grid-cols-[minmax(0,1fr)_5.5rem_4.75rem_4.75rem_5.75rem] items-center gap-2 px-2 text-[11px] font-medium text-white/45'>
                            <span>Clip</span>
                            <span>Duration</span>
                            <span>In</span>
                            <span>Out</span>
                            <span className='text-right'>Order</span>
                        </div>
                        <div className='space-y-2'>
                            {rows.map((row, index) => {
                                const validation = validations.get(row.id);
                                const hasError = Boolean(validation?.error);

                                return (
                                    <div
                                        key={row.id}
                                        className={cn(
                                            'grid grid-cols-1 gap-2 rounded-md border border-white/10 bg-white/[0.04] p-2 md:grid-cols-[minmax(0,1fr)_5.5rem_4.75rem_4.75rem_5.75rem] md:items-center',
                                            hasError && 'border-red-400/40 bg-red-500/10'
                                        )}>
                                        <div className='min-w-0'>
                                            <div className='truncate text-sm font-medium text-white'>
                                                {displayNameForClip(row.item)}
                                            </div>
                                            <div className='mt-0.5 line-clamp-1 text-xs text-white/45'>
                                                {row.item.prompt}
                                            </div>
                                            {validation?.error && (
                                                <div className='mt-1 text-xs text-red-300'>{validation.error}</div>
                                            )}
                                        </div>

                                        <div className='text-sm text-white/65'>
                                            {row.duration ? formatSeconds(row.duration) : '...'}
                                        </div>

                                        <Label className='block space-y-1 text-xs text-white/55 md:space-y-0'>
                                            <span className='md:hidden'>In</span>
                                            <Input
                                                type='number'
                                                min={0}
                                                max={row.duration}
                                                step={0.1}
                                                value={row.inValue}
                                                onChange={(event) => updateRow(row.id, { inValue: event.target.value })}
                                                disabled={isExporting || !row.blob}
                                                aria-invalid={hasError}
                                                className='h-8 rounded-md border-white/15 bg-black/40 text-sm text-white focus-visible:border-white/40 focus-visible:ring-white/20'
                                            />
                                        </Label>

                                        <Label className='block space-y-1 text-xs text-white/55 md:space-y-0'>
                                            <span className='md:hidden'>Out</span>
                                            <Input
                                                type='number'
                                                min={0}
                                                max={row.duration}
                                                step={0.1}
                                                value={row.outValue}
                                                onChange={(event) =>
                                                    updateRow(row.id, { outValue: event.target.value })
                                                }
                                                disabled={isExporting || !row.blob}
                                                aria-invalid={hasError}
                                                className='h-8 rounded-md border-white/15 bg-black/40 text-sm text-white focus-visible:border-white/40 focus-visible:ring-white/20'
                                            />
                                        </Label>

                                        <div className='flex items-center justify-end gap-1'>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                title='Move clip up'
                                                aria-label='Move clip up'
                                                onClick={() => moveRow(index, -1)}
                                                disabled={isExporting || index === 0}
                                                className='h-8 w-8 rounded-md text-white/60 hover:bg-white/10 hover:text-white'>
                                                <ArrowUp size={14} />
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                title='Move clip down'
                                                aria-label='Move clip down'
                                                onClick={() => moveRow(index, 1)}
                                                disabled={isExporting || index === rows.length - 1}
                                                className='h-8 w-8 rounded-md text-white/60 hover:bg-white/10 hover:text-white'>
                                                <ArrowDown size={14} />
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                title='Remove clip'
                                                aria-label='Remove clip'
                                                onClick={() => removeRow(row.id)}
                                                disabled={isExporting}
                                                className='h-8 w-8 rounded-md text-red-200/70 hover:bg-red-500/15 hover:text-red-100'>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className='rounded-md border border-white/10 bg-white/[0.04] p-3'>
                        <div className='mb-3 flex items-center gap-2'>
                            <Music size={15} className='text-white/60' />
                            <div>
                                <h3 className='text-sm font-medium text-white'>Background music</h3>
                                <p className='text-xs text-white/45'>BGM is trimmed to the film&apos;s length.</p>
                            </div>
                        </div>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end'>
                            <div className='space-y-2'>
                                <Label htmlFor='assembly-bgm' className='text-xs text-white/60'>
                                    Audio asset
                                </Label>
                                <Select
                                    value={selectedBgmKey}
                                    onValueChange={setSelectedBgmKey}
                                    disabled={isExporting || isLoadingAudio}>
                                    <SelectTrigger
                                        id='assembly-bgm'
                                        className='h-9 w-full border-white/15 bg-black/40 text-white focus:ring-white/20'>
                                        <SelectValue placeholder='No background music' />
                                    </SelectTrigger>
                                    <SelectContent className='border-white/15 bg-neutral-950 text-white'>
                                        <SelectItem value={NONE_BGM_VALUE}>None</SelectItem>
                                        {audioAssets.map((asset) => (
                                            <SelectItem key={asset.key} value={asset.key}>
                                                {displayNameForAsset(asset)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isLoadingAudio ? (
                                    <p className='text-xs text-white/40'>Loading audio assets...</p>
                                ) : audioError ? (
                                    <p className='text-xs text-amber-200'>{audioError}</p>
                                ) : audioAssets.length === 0 ? (
                                    <p className='text-xs text-white/40'>No audio assets found.</p>
                                ) : null}
                            </div>

                            <div className='space-y-2'>
                                <div className='flex items-center justify-between gap-3'>
                                    <Label className='text-xs text-white/60'>Volume</Label>
                                    <span className='w-10 text-right text-xs text-white/55'>{bgmVolume}%</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[bgmVolume]}
                                    onValueChange={(value) => setBgmVolume(value[0] ?? DEFAULT_BGM_VOLUME)}
                                    disabled={isExporting || selectedBgmKey === NONE_BGM_VALUE}
                                    className='py-3 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-neutral-950 [&_[data-slot=slider-track]]:bg-white/15'
                                />
                            </div>
                        </div>
                    </div>

                    {captionsAvailable && (
                        <div className='rounded-md border border-white/10 bg-white/[0.04] p-3'>
                            <div className='mb-3 flex items-center gap-2'>
                                <Captions size={15} className='text-white/60' />
                                <div>
                                    <h3 className='text-sm font-medium text-white'>Captions</h3>
                                    <p className='text-xs text-white/45'>Language auto-detected.</p>
                                </div>
                            </div>

                            <div className='space-y-3'>
                                <Label
                                    htmlFor='assembly-captions-burn'
                                    className='flex cursor-pointer items-start gap-2 text-sm text-white/75'>
                                    <Checkbox
                                        id='assembly-captions-burn'
                                        checked={burnCaptions}
                                        onCheckedChange={(checked) => {
                                            const enabled = checked === true;
                                            setBurnCaptions(enabled);
                                            if (enabled) setDownloadSrtOnly(false);
                                        }}
                                        disabled={isExporting}
                                        className='mt-0.5 border-white/30 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                    />
                                    <span>
                                        Auto-caption (burn into video)
                                        <span className='mt-0.5 block text-xs text-white/40'>
                                            Burning captions re-encodes the film.
                                        </span>
                                    </span>
                                </Label>

                                <Label
                                    htmlFor='assembly-captions-srt'
                                    className='flex cursor-pointer items-start gap-2 text-sm text-white/75'>
                                    <Checkbox
                                        id='assembly-captions-srt'
                                        checked={downloadSrtOnly}
                                        onCheckedChange={(checked) => {
                                            const enabled = checked === true;
                                            setDownloadSrtOnly(enabled);
                                            if (enabled) setBurnCaptions(false);
                                        }}
                                        disabled={isExporting}
                                        className='mt-0.5 border-white/30 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black'
                                    />
                                    <span>Download .srt only</span>
                                </Label>
                            </div>
                        </div>
                    )}

                    <div className='rounded-md border border-white/10 bg-white/[0.04] p-3'>
                        <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end'>
                            <div className='flex items-start gap-2'>
                                <Crop size={15} className='mt-0.5 text-white/60' />
                                <div>
                                    <h3 className='text-sm font-medium text-white'>Export</h3>
                                    <p className='text-xs text-white/45'>
                                        Source: {rows[0]?.item.size || items[0]?.size || 'Unknown size'}
                                    </p>
                                    {selectedReframe && (
                                        <p className='mt-1 text-xs text-amber-200'>
                                            Reframing re-encodes the film.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className='space-y-2'>
                                <Label htmlFor='assembly-export-format' className='text-xs text-white/60'>
                                    Export format
                                </Label>
                                <Select
                                    value={exportFormat}
                                    onValueChange={(value) => setExportFormat(value as ExportFormatId)}
                                    disabled={isExporting}>
                                    <SelectTrigger
                                        id='assembly-export-format'
                                        className='h-9 w-full border-white/15 bg-black/40 text-white focus:ring-white/20'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className='border-white/15 bg-neutral-950 text-white'>
                                        {EXPORT_FORMATS.map((format) => (
                                            <SelectItem key={format.id} value={format.id}>
                                                {format.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className='border-t border-white/10 bg-black/40 px-5 py-4 sm:items-center sm:justify-between'>
                    <div className='min-w-0 flex-1 space-y-2 text-left'>
                        <div className='text-sm font-medium text-white'>
                            Total runtime: {formatSeconds(totalRuntime)}
                        </div>
                        {exportError ? (
                            <div className='text-xs text-red-300'>{exportError}</div>
                        ) : exportNotice ? (
                            <div className='text-xs text-amber-200'>{exportNotice}</div>
                        ) : firstClipError ? (
                            <div className='text-xs text-red-300'>{firstClipError}</div>
                        ) : (
                            <div className='text-xs text-white/45'>{rows.length} clips in export order</div>
                        )}
                        {exportProgress !== null && (
                            <div className='flex items-center gap-2'>
                                <div className='h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10'>
                                    <div
                                        className='h-full rounded-full bg-white transition-all duration-200'
                                        style={{ width: `${Math.round(exportProgress * 100)}%` }}
                                    />
                                </div>
                                <span className='w-9 text-right text-[11px] text-white/55'>
                                    {Math.round(exportProgress * 100)}%
                                </span>
                            </div>
                        )}
                    </div>
                    <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
                        <Button
                            type='button'
                            variant='ghost'
                            onClick={() => onOpenChange(false)}
                            disabled={isExporting}
                            className='h-9 rounded-md px-3 text-white/60 hover:bg-white/10 hover:text-white'>
                            Cancel
                        </Button>
                        {allRowsHaveCloudUrls ? (
                            <Button
                                type='button'
                                variant='outline'
                                onClick={handleTimelineExport}
                                disabled={!canExportTimeline}
                                title='Export timeline (.xml)'
                                className='h-9 rounded-md border-white/15 bg-white/[0.04] px-3 text-white/75 hover:bg-white/10 hover:text-white disabled:bg-white/[0.04]'>
                                <FileCode2 size={15} />
                                Export timeline (.xml)
                            </Button>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className='inline-flex'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            disabled
                                            title={CLOUD_XML_TOOLTIP}
                                            className='h-9 rounded-md border-white/15 bg-white/[0.04] px-3 text-white/75 hover:bg-white/10 hover:text-white disabled:bg-white/[0.04]'>
                                            <FileCode2 size={15} />
                                            Export timeline (.xml)
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side='top' className='border border-white/20 bg-black text-white'>
                                    {CLOUD_XML_TOOLTIP}
                                </TooltipContent>
                            </Tooltip>
                        )}
                        <Button
                            type='button'
                            onClick={handleExport}
                            disabled={!canExport}
                            className='h-9 rounded-md bg-white px-3 text-black hover:bg-white/90 disabled:bg-white/40'>
                            {isExporting ? (
                                <Loader2 size={15} className='animate-spin' />
                            ) : (
                                <Download size={15} />
                            )}
                            Export
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
