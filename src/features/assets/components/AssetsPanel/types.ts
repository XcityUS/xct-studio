import type {
    AuthorizationItem,
    AuthorizationQueueItem,
    AuthorizationReviewAction,
    CreatedAuthorization
} from '@/features/assets/authorization/api';
import {
    type PortraitAsset,
    type PortraitGroup,
    type PortraitGroupQueryType,
    type PortraitSession,
    type PortraitStatus
} from '@/features/assets/portrait/api';
import type { ReferenceDeclaration, ReferenceOrigin } from '@/features/assets/reference/origin';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import type { UserAsset } from '@/lib/media-archive';

export type AssetsPanelProps = {
    /** Fetches the caller's stored assets (uploads + archived videos). */
    loadAssets: () => Promise<UserAsset[]>;
    deleteAsset: (key: string) => Promise<void>;
    loadAuthorizations: () => Promise<AuthorizationItem[]>;
    submitAuthorization: (input: {
        subjectName: string;
        referenceKey: string;
        note: string;
        file: File;
    }) => Promise<CreatedAuthorization>;
    loadAuthorizationQueue: () => Promise<AuthorizationQueueItem[] | null>;
    reviewAuthorization: (id: string, action: AuthorizationReviewAction, note: string) => Promise<void>;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
    authorizationTargets: {
        key: string;
        label: string;
        url: string;
        kind?: 'image' | 'video';
        authorizationId?: string;
    }[];
    selectedAuthorizationReferenceKey: string | null;
    onAuthorizationSubmitted: (referenceKey: string, authorizationId: string) => void;
    characters: VideoCharacter[];
    addCharacter: (character: VideoCharacter) => void;
    removeCharacter: (id: string) => void;
    portraitEnabled: boolean;
    portraits: VideoPortrait[];
    declarations: Record<string, ReferenceDeclaration>;
    addPortrait: (portrait: VideoPortrait) => void;
    syncPortraitState: () => Promise<void>;
    removePortrait: (assetId: string) => void;
    startPortraitSession: (origin: string) => Promise<PortraitSession>;
    loadPortraitGroups: (type?: PortraitGroupQueryType) => Promise<PortraitGroup[]>;
    createPortraitGroup: (name: string) => Promise<{ groupId: string; slug: string; created: boolean }>;
    createPortraitAsset: (input: {
        groupId: string;
        url: string;
        name: string;
        assetType?: 'Image' | 'Video' | 'Audio';
    }) => Promise<{ assetId: string; status: 'Processing' }>;
    getPortraitAsset: (assetId: string) => Promise<PortraitAsset>;
    /** Operator self-test of the real-human library configuration. */
    getPortraitStatus: () => Promise<PortraitStatus>;
    /** Loads an image asset into the video form's reference list. */
    onUseAsReference: (url: string) => void;
    /** Loads a video asset into the video form's reference video list. */
    onUseAsReferenceVideo: (url: string) => void;
    onAttachAssetId: (input: { assetId: string; origin: ReferenceOrigin }) => boolean;
    /** Sends the user back to the video form to mark a reference for licensing review. */
    onMarkReferenceForAuthorization?: () => void;
    /** The panel fetches lazily — only once it has actually been shown. */
    active: boolean;
};

export type AuthorizationTargetOption = {
    key: string;
    label: string;
    displayName?: string;
    description?: string;
    url: string;
    kind?: 'image' | 'video';
    authorizationId?: string;
};
