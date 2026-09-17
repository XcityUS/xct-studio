import type { ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import type { PortraitGroup } from '@/features/assets/portrait/api';
import type { PortraitSetupRequest } from '@/features/assets/portrait/setup-flow';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { ScriptAnalysisDraft } from '@/features/script/types';
import type { TtsVoice } from '@/lib/tts';
import { type VideoModel, type VideoRatio, type VideoResolution } from '@/shared/config/seedance';
import type {
    ProductionSnapshot,
    ProjectAsset,
    ShortDramaProject,
    ShortDramaProjectInput
} from '@/shared/contracts/production';
import type { VideoJobCreate } from '@/shared/contracts/video';
import * as React from 'react';

export type CreationFormData = VideoJobCreate;
export type SingleImageMode = 'reference' | 'first-frame';

export type CreationSubmitOptions = {
    title?: string;
    replacesItemId?: string;
    rethrowOnError?: boolean;
    onSubmitStage?: (message: string) => void;
};

export type ShortDramaProjectControls = {
    project: ShortDramaProject;
    projects: ShortDramaProject[];
    projectAssets: ProjectAsset[];
    onCreateProject: (input: ShortDramaProjectInput) => void;
    onSelectProject: (projectId: string) => void;
    onUpdateProject: (input: ShortDramaProjectInput) => void;
    onDeleteProject: (projectId: string) => void;
    deletionBlocked?: boolean;
};

export type SceneAssetBindingProgress = {
    done: number;
    total: number;
    targetId?: string;
};

export type AssetBindingOptions = {
    targetId?: string;
    forceGenerate?: boolean;
};

export type ShotVideoPreview = {
    shotIndex: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    jobId: string;
    generatedAt: number;
    hasAudio: boolean;
    ratio?: VideoRatio;
    videoSrc?: string;
    thumbnailSrc?: string | null;
    cost?: number;
    error?: string;
};

export type CreationFormProps = {
    onSubmit: (data: CreationFormData, options?: CreationSubmitOptions) => void | Promise<string | null>;
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
    singleImageMode: SingleImageMode;
    setSingleImageMode: React.Dispatch<React.SetStateAction<SingleImageMode>>;
    declarations: Record<string, ReferenceDeclaration>;
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
    onBreakdownScript?: (script: string) => Promise<ScriptAnalysisDraft>;
    /** Generates/reviews missing scene assets and returns a draft with scene Asset IDs filled. */
    onAutoBindSceneAssets?: (
        draft: EditorDraft,
        onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void,
        options?: AssetBindingOptions
    ) => Promise<EditorDraft>;
    /** Generates/reviews missing character assets and returns a draft with character Asset IDs filled. */
    onAutoBindCharacterAssets?: (
        draft: EditorDraft,
        onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void,
        options?: AssetBindingOptions
    ) => Promise<EditorDraft>;
    /** Queries the current provider status for a bound Project Asset and persists the result. */
    onRefreshAssetStatus?: (assetId: string) => Promise<ProjectAsset['status']>;
    projectAssets?: ProjectAsset[];
    projectConfig?: ShortDramaProject;
    /** Captures the current Project and bound production assets before a generation request is persisted. */
    buildProductionSnapshot?: (shot?: {
        id: string;
        index: number;
        count: number;
        durationSeconds: number;
        assetIds?: string[];
    }) => ProductionSnapshot;
    /** Opens the Assets tab for portrait-library setup. */
    onOpenAssets?: (request?: PortraitSetupRequest) => void;
    /** Short-drama project controls rendered inside the drama creation panel. */
    projectControls?: ShortDramaProjectControls;
    /** Optional controlled state for the storyboard editor dialog. */
    storyboardEditorOpen?: boolean;
    onStoryboardEditorOpenChange?: (open: boolean) => void;
    /** Publishes local storyboard draft changes to the outer short-drama workspace. */
    onStoryboardDraftChange?: (draft: EditorDraft) => void;
    /** Per-shot video generation previews from history/active jobs. */
    shotVideoPreviews?: ShotVideoPreview[];
    /** Successful/neutral feedback from non-submit actions, rendered under the Create button. */
    notice?: string | null;
    /** Clears neutral feedback after direct form edits. */
    onClearNotice?: () => void;
    /** Message from the last submission — rendered under the Create button. */
    error?: string | null;
};

export type GenerationMode = 'draft' | 'final';
