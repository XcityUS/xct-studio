import type { CreationFormData } from './types';
import type { ShotDraft } from '@/features/script/types';
import { SILENT_VOICE_LANGUAGE } from '@/features/script/prompt/guards';
import type { ProductionSnapshot } from '@/shared/contracts/production';

const SHOT_QUEUE_STORAGE_KEY = 'xctStudioShotGenerationQueue';

export type ShotQueueItem = {
    id: string;
    order: number;
    title: string;
    data: CreationFormData;
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
        shot.description.trim(),
        shot.camera?.trim(),
        shot.audio ? `Audio: ${cleanShotAudioCue(shot.audio)}` : ''
    ].filter(Boolean);
    return parts.join(' ');
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
    const refs = [...referenceUrls.map((url) => url.trim()).filter(Boolean)];
    const projectReferenceUrls =
        productionSnapshot?.assetBindings
            .filter((binding) => ['character', 'location', 'prop', 'image', 'style'].includes(binding.role))
            .map((binding) => binding.referenceUrl?.trim())
            .filter((url): url is string => Boolean(url)) ?? [];
    for (const url of projectReferenceUrls) {
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

export function readShotQueue(): ShotQueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(SHOT_QUEUE_STORAGE_KEY) ?? '[]') as unknown;
        return Array.isArray(parsed) ? parsed.filter(isShotQueueItem).sort((a, b) => a.order - b.order) : [];
    } catch {
        return [];
    }
}

export function writeShotQueue(items: ShotQueueItem[]) {
    if (typeof window === 'undefined') return;
    if (items.length === 0) {
        window.localStorage.removeItem(SHOT_QUEUE_STORAGE_KEY);
        return;
    }
    window.localStorage.setItem(SHOT_QUEUE_STORAGE_KEY, JSON.stringify(items));
}
