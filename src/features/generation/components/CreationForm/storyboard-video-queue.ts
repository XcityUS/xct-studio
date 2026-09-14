import { buildShotQueueItem, type ShotQueueItem } from './shot-queue';
import type { CreationFormData } from './types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { inferShotCharacterIds } from '@/features/script/character-matching';
import { DEFAULT_VOICE_LANGUAGE } from '@/features/script/prompt/guards';
import { reviewStoryboard } from '@/features/script/review/storyboard';
import { clampSeconds, secondsRange, type VideoModel } from '@/shared/config/seedance';

export const SHOT_GENERATION_BATCH_LIMIT = 3;

type BuildSubmissionData = (
    prompt: string,
    seconds: number,
    shot: { id: string; index: number; count: number; durationSeconds: number; assetIds?: string[] }
) => CreationFormData;

function assetIdsForShot(draft: EditorDraft, shot: EditorDraft['shots'][number]) {
    const characterIds = new Set(inferShotCharacterIds(shot, draft.characters));
    const characterAssetIds = draft.characters
        .filter((character) => characterIds.has(character.id) && character.assetId)
        .map((character) => character.assetId as string);
    const sceneAssetId = draft.scenes.find((scene) => scene.id === shot.sceneId)?.assetId;
    return Array.from(new Set([...(shot.assetIds ?? []), ...characterAssetIds, ...(sceneAssetId ? [sceneAssetId] : [])]));
}

function hasGeneratedAudioIntent(shot: EditorDraft['shots'][number]) {
    return Boolean(shot.audio?.trim() || shot.dialogues?.some((dialogue) => dialogue.text.trim()));
}

function inferredVoiceLanguage(shot: EditorDraft['shots'][number]) {
    const text = [shot.description, shot.prompt, shot.audio, shot.subtitle, ...(shot.dialogues?.map((item) => item.text) ?? [])].join('');
    return /[\u3400-\u9fff]/.test(text) ? 'zh-CN' : DEFAULT_VOICE_LANGUAGE;
}

export function storyboardVideoQueueItems({
    draft,
    shots,
    activeSeconds,
    activeModel,
    buildSubmissionData,
    titleForShot
}: {
    draft: EditorDraft;
    shots: Array<{ shot: EditorDraft['shots'][number]; index: number }>;
    activeSeconds: number;
    activeModel: VideoModel;
    buildSubmissionData: BuildSubmissionData;
    titleForShot: (index: number) => string;
}): ShotQueueItem[] {
    const range = secondsRange(activeModel);
    if (draft.characters.some((item) => !item.assetId?.trim()) || draft.scenes.some((item) => !item.assetId?.trim())) return [];
    const blockedShotIds = new Set(
        reviewStoryboard({ draft, minDurationSeconds: range.min, maxDurationSeconds: range.max })
            .filter((finding) => finding.severity === 'blocking')
            .map((finding) => finding.shotId)
    );
    return shots
        .filter(({ shot }) => shot.description.trim() && !blockedShotIds.has(shot.id))
        .map(({ shot, index }) => {
            const seconds = clampSeconds(shot.durationSeconds ?? activeSeconds, activeModel);
            const item = buildShotQueueItem({
                shot,
                index,
                title: titleForShot(index),
                total: draft.shots.length,
                globalNote: draft.globalNote,
                seconds,
                assetIds: assetIdsForShot(draft, shot),
                useFormLanguageSettings: true,
                buildSubmissionData
            });
            if (!item.data.generate_audio && hasGeneratedAudioIntent(shot)) {
                item.data.generate_audio = true;
                item.data.voice_language = inferredVoiceLanguage(shot);
            }
            return item;
        });
}
