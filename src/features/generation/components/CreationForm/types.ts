import type { ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import type { PortraitGroup } from '@/features/assets/portrait/api';
import { type ReferenceDeclaration, type ReferenceOrigin } from '@/features/assets/reference/origin';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import { type ShotDraft } from '@/features/script/components/ShotBuilderDialog';
import type { TtsVoice } from '@/lib/tts';
import { type VideoModel, type VideoRatio, type VideoResolution } from '@/shared/config/seedance';
import type { VideoJobCreate } from '@/shared/contracts/video';
import * as React from 'react';

export type CreationFormData = VideoJobCreate;

export type CreationFormProps = {
    onSubmit: (data: CreationFormData) => void;
    isLoading: boolean;
    model: VideoModel;
    setModel: React.Dispatch<React.SetStateAction<VideoModel>>;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    ratio: VideoRatio;
    setRatio: React.Dispatch<React.SetStateAction<VideoRatio>>;
    resolution: VideoResolution;
    setResolution: React.Dispatch<React.SetStateAction<VideoResolution>>;
    seconds: number;
    setSeconds: React.Dispatch<React.SetStateAction<number>>;
    cameraFixed: boolean;
    setCameraFixed: React.Dispatch<React.SetStateAction<boolean>>;
    referenceUrls: string[];
    setReferenceUrls: React.Dispatch<React.SetStateAction<string[]>>;
    declarations: Record<string, ReferenceDeclaration>;
    onDeclareReference: (url: string, origin: ReferenceOrigin) => void;
    approvedAuthorizationIds: ReadonlySet<string>;
    characters: VideoCharacter[];
    portraits: VideoPortrait[];
    virtualCharacterGroups: PortraitGroup[];
    lastFrameUrl: string;
    setLastFrameUrl: React.Dispatch<React.SetStateAction<string>>;
    referenceAudioUrl: string;
    setReferenceAudioUrl: React.Dispatch<React.SetStateAction<string>>;
    referenceVideoUrls: string[];
    setReferenceVideoUrls: React.Dispatch<React.SetStateAction<string[]>>;
    seed: number | undefined;
    setSeed: React.Dispatch<React.SetStateAction<number | undefined>>;
    watermark: boolean;
    setWatermark: React.Dispatch<React.SetStateAction<boolean>>;
    watermarkText: string;
    setWatermarkText: React.Dispatch<React.SetStateAction<string>>;
    voiceLanguage: string;
    setVoiceLanguage: React.Dispatch<React.SetStateAction<string>>;
    captionMode: string;
    setCaptionMode: React.Dispatch<React.SetStateAction<string>>;
    titleOverlayEnabled: boolean;
    setTitleOverlayEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    titleOverlayText: string;
    setTitleOverlayText: React.Dispatch<React.SetStateAction<string>>;
    titleOverlayStyle: string;
    setTitleOverlayStyle: React.Dispatch<React.SetStateAction<string>>;
    titleOverlayDuration: string;
    setTitleOverlayDuration: React.Dispatch<React.SetStateAction<string>>;
    titleOverlayLanguage: string;
    setTitleOverlayLanguage: React.Dispatch<React.SetStateAction<string>>;
    /** Uploads a local image, resolving to its public URL. Absent = URL-only mode. */
    onUploadImage?: (file: File) => Promise<string>;
    /** Uploads a local audio file, resolving to its public URL. Absent = URL-only mode. */
    onUploadAudio?: (file: File) => Promise<string>;
    /** Generates speech, uploads it, and resolves to its public URL. */
    onSynthesizeSpeech?: (text: string, voice: TtsVoice) => Promise<string>;
    /** Uploads a local video file, resolving to its public URL. Absent = URL-only mode. */
    onUploadVideo?: (file: File) => Promise<string>;
    /** Reviews a supported reference through BytePlus and returns its active asset:// reference. */
    onReviewReferenceAsset?: (input: ProviderAssetReviewInput) => Promise<string>;
    /** Rewrites the prompt via the gateway's chat API. Absent = button hidden. */
    onOptimizePrompt?: (prompt: string) => Promise<string>;
    /** Splits a script into Seedance shot rows via the gateway's chat API. */
    onBreakdownScript?: (script: string) => Promise<ShotDraft[]>;
    /** Opens the Assets tab for portrait-library setup. */
    onOpenAssets?: (referenceKey?: string) => void;
    /** Successful/neutral feedback from non-submit actions, rendered under the Create button. */
    notice?: string | null;
    /** Clears neutral feedback after direct form edits. */
    onClearNotice?: () => void;
    /** Message from the last submission — rendered under the Create button. */
    error?: string | null;
};

export type GenerationMode = 'draft' | 'final';
