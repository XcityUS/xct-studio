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

export type ShortDramaProject = {
    id: string;
    title: string;
    sourceLanguage: string;
    targetRatio: string;
    styleNote: string;
    createdAt: number;
    updatedAt: number;
};

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
