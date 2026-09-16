import type { ProviderAssetReviewInput } from '@/features/assets/hooks/use-provider-asset-review';
import type { PortraitSetupRequest } from '@/features/assets/portrait/setup-flow';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/history/merge';
import type { UserAsset } from '@/lib/media-archive';

export interface ReferenceImagesInputProps {
    /** Public image URLs, in order — [Image 1], [Image 2], … in the prompt. */
    urls: string[];
    onChange: (urls: string[]) => void;
    /** Per-model cap: 1 = first-frame only, 9 = Seedance 2.x reference mode. */
    maxImages: number;
    /** Optional last-frame URL used only when exactly one first-frame image is set. */
    lastFrameUrl?: string;
    onLastFrameChange?: (url: string) => void;
    /** Uploads a local file and resolves to its public URL. Absent = URL-only mode. */
    onUpload?: (file: File) => Promise<string>;
    declarations: Record<string, ReferenceDeclaration>;
    approvedAuthorizationIds: ReadonlySet<string>;
    onOpenAssets?: (request?: PortraitSetupRequest) => void;
    characters?: VideoCharacter[];
    portraits?: VideoPortrait[];
    imageAssets?: UserAsset[];
    isLoadingImageAssets?: boolean;
    onRefreshImageAssets?: () => void;
    onReviewReferenceAsset?: (input: ProviderAssetReviewInput) => Promise<string>;
    onSwitchToAssetModel?: () => void;
    label?: string;
    hint?: string;
    showCharacters?: boolean;
    showAssetLibrary?: boolean;
    disabled?: boolean;
}
