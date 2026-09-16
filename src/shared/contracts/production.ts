export type ProjectAssetKind =
    | 'character'
    | 'location'
    | 'prop'
    | 'audio'
    | 'video'
    | 'image'
    | 'document'
    | 'style'
    | 'other';

export type ProjectAssetStatus = 'uploaded' | 'reviewing' | 'active' | 'failed' | 'revoked' | 'archived';

export type ProjectAssetSourceType =
    | 'upload'
    | 'generated'
    | 'provider'
    | 'official'
    | 'external'
    | 'real_person'
    | 'protected_ip'
    | 'manual';

export type ProductionReferenceOrigin =
    | 'uploaded'
    | 'no-person'
    | 'official-asset'
    | 'byteplus-ai'
    | 'thirdparty-ai'
    | 'real-person'
    | 'public-figure'
    | 'licensed-ip';

export type ProjectAsset = {
    id: string;
    projectId: string;
    name: string;
    kind: ProjectAssetKind;
    status: ProjectAssetStatus;
    sourceType: ProjectAssetSourceType;
    mediaKey?: string;
    sourceUrl?: string;
    providerReferenceUrl?: string;
    providerAssetId?: string;
    origin?: ProductionReferenceOrigin;
    note?: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
};

export type CharacterVersion = {
    id: string;
    projectId: string;
    name: string;
    role?: string;
    providerGroupId?: string;
    referenceAssetIds: string[];
    createdAt: number;
    updatedAt: number;
};

export type DramaContentLanguage =
    | 'en-US'
    | 'zh-CN'
    | 'ja-JP'
    | 'ko-KR'
    | 'es-ES'
    | 'fr-FR'
    | 'de-DE'
    | 'pt-BR'
    | 'it-IT'
    | 'ar-SA';
export type DramaSubtitleMode = 'none' | 'source';

export type ShortDramaProject = {
    id: string;
    title: string;
    genre: string;
    sourceLanguage: DramaContentLanguage;
    voiceLanguage: DramaContentLanguage | 'silent';
    subtitleMode: DramaSubtitleMode;
    targetRatio: string;
    targetResolution: string;
    generationModel: string;
    watermark: boolean;
    watermarkText?: string;
    basePrompt: string;
    styleNote: string;
    createdAt: number;
    updatedAt: number;
};

export type ShortDramaProjectInput = Omit<ShortDramaProject, 'id' | 'createdAt' | 'updatedAt'>;

export type ShotAssetBinding = {
    projectAssetId: string;
    role: ProjectAssetKind;
    label: string;
    referenceUrl?: string;
    providerAssetId?: string;
};

export type ProductionSnapshot = {
    version: 1;
    source: 'local-draft';
    project: ShortDramaProject;
    shot?: {
        id: string;
        index: number;
        count: number;
        durationSeconds: number;
        assetIds?: string[];
    };
    assetBindings: ShotAssetBinding[];
    capturedAt: number;
};

export type ProjectState = {
    activeProjectId: string;
    projects: ShortDramaProject[];
    assets: ProjectAsset[];
    characterVersions: CharacterVersion[];
};
