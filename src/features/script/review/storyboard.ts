import type { StoryboardFinding, StoryboardReviewInput } from './types';
import type { ScriptDialogueDraft } from '@/features/script/types';

const VISIBLE_ACTION =
    /(?:走|跑|看向|望向|凝望|拿|放|推|拉|打开|关上|坐下|站起|转向|抬起|低下|笑|哭|喊|递|摔|打|抱|握|指向|进入|离开|回头|转身|walk|run|look|take|put|push|pull|open|close|sit|stand|turn|smile|cry|shout|hold|point|enter|leave)/iu;
const ABSTRACT_STATE =
    /(?:感觉|感到|意识到|想起|认为|明白|内心|绝望|崩溃|后悔|害怕|希望|决定|realize|remember|think|feel|regret|fear|hope|decide|devastated)/iu;

function dialogueUnits(text: string): number {
    const compact = text.replace(/[\s\p{P}\p{S}]/gu, '');
    const han = compact.match(/\p{Script=Han}/gu)?.length ?? 0;
    const words = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
    return han / 4 + words / 2.5;
}

export function estimateDialogueSeconds(dialogues: ScriptDialogueDraft[] | undefined): number {
    if (!dialogues?.length) return 0;
    const spoken = dialogues.reduce((seconds, dialogue) => seconds + dialogueUnits(dialogue.text), 0);
    return Math.ceil(spoken + Math.max(dialogues.length - 1, 0) * 0.35);
}

export function reviewStoryboard(input: StoryboardReviewInput): StoryboardFinding[] {
    const { draft, minDurationSeconds, maxDurationSeconds } = input;
    const characterIds = new Set(draft.characters.map((character) => character.id));
    const sceneIds = new Set(draft.scenes.map((scene) => scene.id));
    const earlierShotIds = new Set<string>();
    const findings: StoryboardFinding[] = [];
    const add = (finding: Omit<StoryboardFinding, 'id'>) =>
        findings.push({ ...finding, id: `${finding.shotId}:${finding.code}:${findings.length}` });

    draft.characters.forEach((character, characterIndex) => {
        if (character.assetId?.trim()) return;
        add({
            shotId: `character:${character.id}`,
            shotIndex: characterIndex,
            targetType: 'character',
            targetLabel: character.name,
            code: 'UNBOUND_CHARACTER_ASSET',
            severity: 'blocking',
            capabilityIds: ['screenwriting:sw-character-conflict', 'screenwriting:sw-series-engine-bible']
        });
    });
    draft.scenes.forEach((scene, sceneIndex) => {
        if (scene.assetId?.trim()) return;
        add({
            shotId: `scene:${scene.id}`,
            shotIndex: sceneIndex,
            targetType: 'scene',
            targetLabel: scene.name,
            code: 'UNBOUND_SCENE_ASSET',
            severity: 'blocking',
            capabilityIds: ['screenwriting:sw-scene-craft', 'screenwriting:sw-series-engine-bible']
        });
    });

    draft.shots.forEach((shot, shotIndex) => {
        const shotId = shot.id || `shot-${shotIndex + 1}`;
        const description = shot.description.trim();
        const base = { shotId, shotIndex };
        if (!description) {
            add({
                ...base,
                code: 'MISSING_DESCRIPTION',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-scene-craft']
            });
        }
        const duration = shot.durationSeconds;
        if (
            !Number.isInteger(duration) ||
            (duration ?? 0) < minDurationSeconds ||
            (duration ?? 0) > maxDurationSeconds
        ) {
            add({
                ...base,
                code: 'INVALID_DURATION',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-writers-room'],
                details: { min: minDurationSeconds, max: maxDurationSeconds }
            });
        }
        const dialogueSeconds = estimateDialogueSeconds(shot.dialogues);
        if (duration && dialogueSeconds > duration) {
            add({
                ...base,
                code: 'DIALOGUE_TOO_LONG',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-dialogue'],
                evidence: shot.dialogues?.map((dialogue) => dialogue.text).join(' / '),
                details: { required: dialogueSeconds, available: duration }
            });
        }
        if (
            shot.dialogues?.some(
                (dialogue) => !dialogue.speakerCharacterId || !characterIds.has(dialogue.speakerCharacterId)
            )
        ) {
            add({
                ...base,
                code: 'UNKNOWN_DIALOGUE_SPEAKER',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-dialogue', 'screenwriting:sw-character-conflict']
            });
        }
        const unknownCharacters = (shot.characterIds ?? []).filter((id) => !characterIds.has(id));
        if (unknownCharacters.length) {
            add({
                ...base,
                code: 'UNKNOWN_CHARACTER_REFERENCE',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-character-conflict'],
                evidence: unknownCharacters.join(', ')
            });
        }
        if (shot.sceneId && !sceneIds.has(shot.sceneId)) {
            add({
                ...base,
                code: 'UNKNOWN_SCENE_REFERENCE',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-scene-craft'],
                evidence: shot.sceneId
            });
        }
        if (shot.continuitySourceShotId && !earlierShotIds.has(shot.continuitySourceShotId)) {
            add({
                ...base,
                code: 'INVALID_CONTINUITY_SOURCE',
                severity: 'blocking',
                capabilityIds: ['screenwriting:sw-series-engine-bible'],
                evidence: shot.continuitySourceShotId
            });
        }
        if (description && ABSTRACT_STATE.test(description) && !VISIBLE_ACTION.test(description)) {
            add({
                ...base,
                code: 'ABSTRACT_VISUAL_DESCRIPTION',
                severity: 'warning',
                capabilityIds: ['screenwriting:sw-scene-craft'],
                evidence: description
            });
        }
        if ((shot.characterIds?.length ?? 0) > 3) {
            add({
                ...base,
                code: 'HIGH_CAST_COMPLEXITY',
                severity: 'warning',
                capabilityIds: ['screenwriting:sw-writers-room'],
                details: { count: shot.characterIds?.length ?? 0 }
            });
        }
        earlierShotIds.add(shotId);
    });
    return findings;
}
