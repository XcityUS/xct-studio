import type { ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import {
    type PortraitAsset,
    type PortraitGroup,
    type PortraitGroupQueryType,
    type ProviderLibraryAsset,
    type PortraitSession,
    type PortraitStatus
} from '@/features/assets/portrait/api';
import type { ReferenceDeclaration, ReferenceOrigin } from '@/features/assets/reference/origin';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import type { UserAsset } from '@/lib/media-archive';
import type { ProjectAsset, ProjectAssetKind } from '@/shared/contracts/production';

export type ReferenceUseOptions = {
    stayOnAssets?: boolean;
};

export type AssetsPanelProps = {
    /** Fetches the caller's stored assets (uploads + archived videos). */
    loadAssets: () => Promise<UserAsset[]>;
    deleteAsset: (key: string) => Promise<void>;
    characters: VideoCharacter[];
    addCharacter: (character: VideoCharacter) => void;
    removeCharacter: (id: string) => void;
    portraitEnabled: boolean;
    portraits: VideoPortrait[];
    deletedIds: string[];
    declarations: Record<string, ReferenceDeclaration>;
    referenceImageUrls: string[];
    addPortrait: (portrait: VideoPortrait) => void;
    syncPortraitState: () => Promise<void>;
    removePortrait: (assetId: string) => void;
    startPortraitSession: (origin: string) => Promise<PortraitSession>;
    loadPortraitGroups: (type?: PortraitGroupQueryType) => Promise<PortraitGroup[]>;
    loadPortraitAssets: (type?: PortraitGroupQueryType) => Promise<ProviderLibraryAsset[]>;
    createPortraitGroup: (name: string) => Promise<{ groupId: string; slug: string; created: boolean }>;
    deletePortraitGroup: (groupId: string) => Promise<void>;
    createPortraitAsset: (input: {
        groupId: string;
        url: string;
        name: string;
        assetType?: 'Image' | 'Video' | 'Audio';
    }) => Promise<{ assetId: string; status: 'Processing' }>;
    getPortraitAsset: (assetId: string) => Promise<PortraitAsset>;
    /** Operator self-test of the real-human library configuration. */
    getPortraitStatus: () => Promise<PortraitStatus>;
    reviewAsset: (input: ProviderAssetReviewInput) => Promise<string>;
    /** Loads an image asset into the video form's reference list. */
    onUseAsReference: (sourceUrl: string, providerReferenceUrl?: string, options?: ReferenceUseOptions) => void;
    /** Loads a video asset into the video form's reference video list. */
    onUseAsReferenceVideo: (sourceUrl: string, providerReferenceUrl?: string) => void;
    onAttachAssetId: (input: { assetId: string; origin: ReferenceOrigin; note?: string }) => boolean;
    onUpdateOfficialAssetNote: (key: string, note: string) => void;
    projectAssets?: ProjectAsset[];
    onChangeProjectAssetKind?: (assetId: string, kind: ProjectAssetKind) => void;
    onRemoveProjectAsset?: (assetId: string) => void;
    onSyncProjectAssetStatuses?: (statusesByProviderAssetId: Record<string, ProjectAsset['status']>) => void;
    /** The panel fetches lazily — only once it has actually been shown. */
    active: boolean;
};

/** Compatibility shape for historical authorization records that remain readable in storage. */
export type AuthorizationTargetOption = {
    key: string;
    label: string;
    displayName?: string;
    description?: string;
    url: string;
    kind?: 'image' | 'video';
    authorizationId?: string;
};
