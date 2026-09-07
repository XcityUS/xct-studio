import { type VideoRatio } from '@/shared/config/seedance';
import { type CaptionSegment } from '@/lib/captions';
import { type UserAsset } from '@/lib/media-archive';
import type { VideoMetadata } from '@/shared/contracts/video';

export type ExportFormatId = 'original' | 'vertical' | 'square' | 'widescreen';

export type ExportFormatOption = {
    id: ExportFormatId;
    label: string;
    ratio?: VideoRatio;
    reframe?: {
        width: number;
        height: number;
    };
};

export type AssemblyEditorProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: VideoMetadata[];
    resolveClipBlob: (item: VideoMetadata) => Promise<Blob>;
    loadAudioAssets?: () => Promise<UserAsset[]>;
    onTranscribeVideo?: (blob: Blob) => Promise<CaptionSegment[]>;
};

export type ClipRow = {
    id: string;
    item: VideoMetadata;
    blob?: Blob;
    duration?: number;
    inValue: string;
    outValue: string;
    error?: string;
};

export type ClipValidation = {
    inTime: number;
    outTime: number;
    error?: string;
};
