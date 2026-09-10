import { DEFAULT_RESOLUTION, DEFAULT_SHORT_DRAMA_MODEL, isShortDramaModel } from '@/shared/config/seedance';
import type {
    CharacterVersion,
    ProjectAsset,
    ProjectAssetKind,
    ProjectAssetSourceType,
    ProjectAssetStatus,
    ProjectState,
    ShortDramaProjectInput,
    ShortDramaProject
} from '@/shared/contracts/production';

const STORAGE_KEY = 'xctStudioShortDramaProjects';
const DEFAULT_PROJECT_ID = 'local_project_default';

function now(): number {
    return Date.now();
}

function createId(prefix: string): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `${prefix}_${crypto.randomUUID()}`
        : `${prefix}_${now()}_${Math.random().toString(36).slice(2)}`;
}

function titleKey(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function defaultProject(): ShortDramaProject {
    const timestamp = now();
    return {
        id: DEFAULT_PROJECT_ID,
        title: 'Untitled short-drama project',
        genre: 'Drama',
        sourceLanguage: 'zh-CN',
        voiceLanguage: 'zh-CN',
        subtitleMode: 'source',
        targetRatio: '9:16',
        targetResolution: DEFAULT_RESOLUTION,
        generationModel: DEFAULT_SHORT_DRAMA_MODEL,
        watermark: false,
        basePrompt: '',
        styleNote: '',
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

function isProjectAssetKind(value: unknown): value is ProjectAssetKind {
    return (
        value === 'character' ||
        value === 'location' ||
        value === 'prop' ||
        value === 'audio' ||
        value === 'video' ||
        value === 'image' ||
        value === 'document' ||
        value === 'style' ||
        value === 'other'
    );
}

function isProjectAssetStatus(value: unknown): value is ProjectAssetStatus {
    return (
        value === 'uploaded' ||
        value === 'reviewing' ||
        value === 'active' ||
        value === 'failed' ||
        value === 'revoked' ||
        value === 'archived'
    );
}

function isProjectAssetSourceType(value: unknown): value is ProjectAssetSourceType {
    return (
        value === 'upload' ||
        value === 'generated' ||
        value === 'provider' ||
        value === 'official' ||
        value === 'external' ||
        value === 'real_person' ||
        value === 'protected_ip' ||
        value === 'manual'
    );
}

function isDramaContentLanguage(value: unknown): value is ShortDramaProject['sourceLanguage'] {
    return (
        value === 'en-US' ||
        value === 'zh-CN' ||
        value === 'ja-JP' ||
        value === 'ko-KR' ||
        value === 'es-ES' ||
        value === 'fr-FR' ||
        value === 'de-DE' ||
        value === 'pt-BR' ||
        value === 'it-IT' ||
        value === 'ar-SA'
    );
}

function normalizeShortDramaModel(value: unknown): string {
    return typeof value === 'string' && isShortDramaModel(value) ? value : DEFAULT_SHORT_DRAMA_MODEL;
}

function normalizeProject(value: unknown): ShortDramaProject | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<ShortDramaProject>;
    if (typeof record.id !== 'string' || typeof record.title !== 'string') return null;
    return {
        id: record.id,
        title: record.title,
        genre: typeof record.genre === 'string' ? record.genre : 'Drama',
        sourceLanguage: isDramaContentLanguage(record.sourceLanguage) ? record.sourceLanguage : 'zh-CN',
        voiceLanguage:
            record.voiceLanguage === 'silent' || isDramaContentLanguage(record.voiceLanguage)
                ? record.voiceLanguage
                : 'zh-CN',
        subtitleMode: record.subtitleMode === 'none' ? 'none' : 'source',
        targetRatio: typeof record.targetRatio === 'string' ? record.targetRatio : '9:16',
        targetResolution: typeof record.targetResolution === 'string' ? record.targetResolution : DEFAULT_RESOLUTION,
        generationModel: normalizeShortDramaModel(record.generationModel),
        watermark: record.watermark === true,
        watermarkText: typeof record.watermarkText === 'string' ? record.watermarkText : undefined,
        basePrompt: typeof record.basePrompt === 'string' ? record.basePrompt : '',
        styleNote: typeof record.styleNote === 'string' ? record.styleNote : '',
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : now(),
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now()
    };
}

function normalizeProjectAsset(value: unknown): ProjectAsset | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<ProjectAsset>;
    if (typeof record.id !== 'string' || typeof record.projectId !== 'string' || typeof record.name !== 'string') {
        return null;
    }
    return {
        id: record.id,
        projectId: record.projectId,
        name: record.name,
        kind: isProjectAssetKind(record.kind) ? record.kind : 'other',
        status: isProjectAssetStatus(record.status) ? record.status : 'uploaded',
        sourceType: isProjectAssetSourceType(record.sourceType) ? record.sourceType : 'manual',
        mediaKey: typeof record.mediaKey === 'string' ? record.mediaKey : undefined,
        sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined,
        providerReferenceUrl: typeof record.providerReferenceUrl === 'string' ? record.providerReferenceUrl : undefined,
        providerAssetId: typeof record.providerAssetId === 'string' ? record.providerAssetId : undefined,
        origin: record.origin,
        note: typeof record.note === 'string' ? record.note : undefined,
        tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : now(),
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now()
    };
}

function normalizeCharacterVersion(value: unknown): CharacterVersion | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<CharacterVersion>;
    if (typeof record.id !== 'string' || typeof record.projectId !== 'string' || typeof record.name !== 'string') {
        return null;
    }
    return {
        id: record.id,
        projectId: record.projectId,
        name: record.name,
        role: typeof record.role === 'string' ? record.role : undefined,
        providerGroupId: typeof record.providerGroupId === 'string' ? record.providerGroupId : undefined,
        referenceAssetIds: Array.isArray(record.referenceAssetIds)
            ? record.referenceAssetIds.filter((id): id is string => typeof id === 'string')
            : [],
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : now(),
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now()
    };
}

function isShortDramaProject(value: ShortDramaProject | null): value is ShortDramaProject {
    return value !== null;
}

function isProjectAsset(value: ProjectAsset | null): value is ProjectAsset {
    return value !== null;
}

function isCharacterVersion(value: CharacterVersion | null): value is CharacterVersion {
    return value !== null;
}

function dedupeProjects(projects: ShortDramaProject[]): ShortDramaProject[] {
    const seen = new Set<string>();
    return projects.filter((project) => {
        const key = titleKey(project.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeState(value: unknown): ProjectState {
    const fallback = defaultProject();
    if (!value || typeof value !== 'object') {
        return { activeProjectId: fallback.id, projects: [fallback], assets: [], characterVersions: [] };
    }
    const record = value as Partial<ProjectState>;
    const projects = Array.isArray(record.projects)
        ? dedupeProjects(record.projects.map(normalizeProject).filter(isShortDramaProject))
        : [];
    const safeProjects = projects.length ? projects : [fallback];
    const activeProjectId =
        typeof record.activeProjectId === 'string' &&
        safeProjects.some((project) => project.id === record.activeProjectId)
            ? record.activeProjectId
            : safeProjects[0].id;
    return {
        activeProjectId,
        projects: safeProjects,
        assets: Array.isArray(record.assets) ? record.assets.map(normalizeProjectAsset).filter(isProjectAsset) : [],
        characterVersions: Array.isArray(record.characterVersions)
            ? record.characterVersions.map(normalizeCharacterVersion).filter(isCharacterVersion)
            : []
    };
}

export function readProjectState(): ProjectState {
    if (typeof window === 'undefined') {
        const project = defaultProject();
        return { activeProjectId: project.id, projects: [project], assets: [], characterVersions: [] };
    }
    try {
        return normalizeState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown);
    } catch {
        return normalizeState(null);
    }
}

export function writeProjectState(state: ProjectState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

export function createProject(input: ShortDramaProjectInput, existingTitles: string[] = []): ShortDramaProject {
    const title = input.title.trim() || 'Untitled short-drama project';
    if (existingTitles.some((existingTitle) => titleKey(existingTitle) === titleKey(title))) {
        throw new Error('DUPLICATE_PROJECT_TITLE');
    }
    const timestamp = now();
    return {
        id: createId('project'),
        ...input,
        title,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

export function defaultProjectInput(title = ''): ShortDramaProjectInput {
    const project = defaultProject();
    return {
        title,
        genre: project.genre,
        sourceLanguage: project.sourceLanguage,
        voiceLanguage: project.voiceLanguage,
        subtitleMode: project.subtitleMode,
        targetRatio: project.targetRatio,
        targetResolution: project.targetResolution,
        generationModel: project.generationModel,
        watermark: project.watermark,
        basePrompt: project.basePrompt,
        styleNote: project.styleNote
    };
}

export function createProjectAsset(input: Omit<ProjectAsset, 'id' | 'createdAt' | 'updatedAt'>): ProjectAsset {
    const timestamp = now();
    return { ...input, id: createId('project_asset'), createdAt: timestamp, updatedAt: timestamp };
}

export function createCharacterVersion(
    input: Omit<CharacterVersion, 'id' | 'createdAt' | 'updatedAt'>
): CharacterVersion {
    const timestamp = now();
    return { ...input, id: createId('character_version'), createdAt: timestamp, updatedAt: timestamp };
}
