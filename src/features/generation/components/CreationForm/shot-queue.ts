import { businessStorage } from '@/features/persistence/store';
import type { CreationFormData } from './types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { SILENT_VOICE_LANGUAGE } from '@/features/script/prompt/guards';
import type { ShotDraft } from '@/features/script/types';
import type { ProductionSnapshot } from '@/shared/contracts/production';

const SHOT_QUEUE_STORAGE_KEY = 'xctStudioShotGenerationQueue';

export type ShotQueueItem = {
    id: string;
    order: number;
    title: string;
    data: CreationFormData;
    projectKey?: string;
    draftSignature?: string;
    createdAt?: number;
};

export type ShotQueueScope = {
    projectKey: string;
    draftSignature: string;
};

function stableHash(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
}

export function storyboardQueueSignature(draft: EditorDraft | undefined) {
    if (!draft) return 'empty';
    return stableHash(
        JSON.stringify({
            globalNote: draft.globalNote,
            characters: draft.characters.map((character) => ({
                id: character.id,
                name: character.name,
                assetId: character.assetId
            })),
            scenes: draft.scenes.map((scene) => ({ id: scene.id, name: scene.name, assetId: scene.assetId })),
            shots: draft.shots.map((shot) => ({
                id: shot.id,
                description: shot.description,
                prompt: shot.prompt,
                camera: shot.camera,
                audio: shot.audio,
                durationSeconds: shot.durationSeconds,
                sceneId: shot.sceneId,
                characterIds: shot.characterIds,
                subtitle: shot.subtitle,
                continuitySourceShotId: shot.continuitySourceShotId
            }))
        })
    );
}

type BuildShotQueueItemInput = {
    shot: ShotDraft;
    index: number;
    total: number;
    globalNote: string;
    seconds: number;
    title: string;
    assetIds?: string[];
    useFormLanguageSettings: boolean;
    buildSubmissionData: (
        prompt: string,
        seconds: number,
        shot: { id: string; index: number; count: number; durationSeconds: number; assetIds?: string[] }
    ) => CreationFormData;
};

export function createQueueId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `shot_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function cleanShotAudioCue(audio: string): string {
    return audio
        .trim()
        .replace(/^\{+|\}+$/g, '')
        .trim();
}

export function compileShotPrompt(shot: ShotDraft, index: number, total: number): string {
    const parts = [
        `Shot ${index + 1}/${total}.`,
        shot.prompt?.trim(),
        shot.description.trim(),
        shot.camera?.trim(),
        shot.audio ? `Audio: ${cleanShotAudioCue(shot.audio)}` : '',
        shot.dialogues
            ?.map((dialogue) => `${dialogue.emotion ? `${dialogue.emotion}: ` : ''}${dialogue.text}`)
            .join(' '),
        shot.subtitle?.trim() ? `Subtitle: ${shot.subtitle.trim()}` : ''
    ].filter(Boolean);
    return parts.join(' ');
}

export function buildShotQueueItem({
    shot,
    index,
    total,
    globalNote,
    seconds,
    title,
    assetIds,
    useFormLanguageSettings,
    buildSubmissionData
}: BuildShotQueueItemInput): ShotQueueItem {
    const shotPrompt = [globalNote.trim(), compileShotPrompt(shot, index, total)].filter(Boolean).join('\n');
    const shotId = createQueueId();
    const baseData = buildSubmissionData(shotPrompt, seconds, {
        id: shotId,
        index: index + 1,
        count: total,
        durationSeconds: seconds,
        assetIds
    });
    return {
        id: shotId,
        order: index + 1,
        title,
        data: {
            ...(useFormLanguageSettings ? baseData : withoutGeneratedLanguage(baseData)),
            episode_shot: { shotIndex: index + 1, shotCount: total, durationSeconds: seconds }
        }
    };
}

export function withoutGeneratedLanguage(formData: CreationFormData): CreationFormData {
    return {
        ...formData,
        generate_audio: false,
        avoid_generated_captions: true,
        voice_language: SILENT_VOICE_LANGUAGE,
        caption_mode: 'none',
        title_overlay_enabled: false,
        title_overlay_text: undefined,
        title_overlay_style: undefined,
        title_overlay_duration: undefined,
        title_overlay_language: undefined
    };
}

export function appendProjectReferenceUrls(
    referenceUrls: string[],
    productionSnapshot: ProductionSnapshot | undefined,
    maxReferences: number
): string[] {
    const refs: string[] = [];
    const shotAssetUrls = productionSnapshot?.shot?.assetIds
        ?.map((assetId) => assetId.trim())
        .filter((assetId) => assetId.startsWith('asset://') || assetId.startsWith('asset-'))
        .map((assetId) => (assetId.startsWith('asset://') ? assetId : `asset://${assetId}`)) ?? [];
    const projectReferenceUrls = [
        ...(productionSnapshot?.assetBindings
            .filter((binding) => ['character', 'location', 'prop', 'image', 'style'].includes(binding.role))
            .map((binding) => binding.referenceUrl?.trim())
            .filter((url): url is string => Boolean(url)) ?? []),
        ...referenceUrls.map((url) => url.trim()).filter(Boolean)
    ];
    for (const url of [...shotAssetUrls, ...projectReferenceUrls]) {
        if (refs.length >= maxReferences) break;
        if (!refs.includes(url)) refs.push(url);
    }
    return refs;
}

function isShotQueueItem(value: unknown): value is ShotQueueItem {
    if (!value || typeof value !== 'object') return false;
    const record = value as Partial<ShotQueueItem>;
    return (
        typeof record.id === 'string' &&
        typeof record.order === 'number' &&
        typeof record.title === 'string' &&
        Boolean(record.data) &&
        typeof record.data === 'object' &&
        typeof record.data.prompt === 'string' &&
        typeof record.data.seconds === 'number'
    );
}

function readAllShotQueue(): ShotQueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(businessStorage.getItem(SHOT_QUEUE_STORAGE_KEY) ?? '[]') as unknown;
        return Array.isArray(parsed) ? parsed.filter(isShotQueueItem).sort((a, b) => a.order - b.order) : [];
    } catch {
        return [];
    }
}

function matchesScope(item: ShotQueueItem, scope: ShotQueueScope) {
    return item.projectKey === scope.projectKey && item.draftSignature === scope.draftSignature;
}

export function readShotQueue(scope?: ShotQueueScope): ShotQueueItem[] {
    const items = readAllShotQueue();
    return scope ? items.filter((item) => matchesScope(item, scope)) : items;
}

export function writeShotQueue(items: ShotQueueItem[], scope?: ShotQueueScope) {
    if (typeof window === 'undefined') return;
    const nextItems = scope
        ? [
              ...readAllShotQueue().filter((item) => !matchesScope(item, scope)),
              ...items.map((item) => ({
                  ...item,
                  projectKey: scope.projectKey,
                  draftSignature: scope.draftSignature,
                  createdAt: item.createdAt ?? Date.now()
              }))
          ].sort((a, b) => a.order - b.order)
        : items;
    if (nextItems.length === 0) {
        businessStorage.removeItem(SHOT_QUEUE_STORAGE_KEY);
        return;
    }
    businessStorage.setItem(SHOT_QUEUE_STORAGE_KEY, JSON.stringify(nextItems));
}
