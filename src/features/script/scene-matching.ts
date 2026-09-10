import type { ScriptSceneDraft, ShotDraft } from './types';

function normalize(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, '');
}

function sceneText(scene: ScriptSceneDraft) {
    return normalize([scene.name, scene.description, ...scene.evidence].join(' '));
}

function shotText(shot: Pick<ShotDraft, 'description' | 'prompt' | 'camera' | 'audio' | 'subtitle'>) {
    return normalize([shot.prompt, shot.description, shot.camera, shot.audio, shot.subtitle].filter(Boolean).join(' '));
}

export function resolveSceneId(reference: string, scenes: ScriptSceneDraft[]) {
    const key = normalize(reference);
    if (!key) return undefined;
    const exact = scenes.find((scene) => [scene.id, scene.name].some((value) => normalize(value) === key));
    if (exact) return exact.id;
    return scenes.find((scene) => sceneText(scene).includes(key) || key.includes(normalize(scene.name)))?.id;
}

export function inferShotSceneId(shot: Pick<ShotDraft, 'description' | 'prompt' | 'camera' | 'audio' | 'subtitle'>, scenes: ScriptSceneDraft[]) {
    const text = shotText(shot);
    if (!text) return undefined;
    return scenes.find((scene) => text.includes(normalize(scene.name)) || sceneText(scene).includes(text.slice(0, 12)))?.id;
}

export function ensureShotSceneIds<T extends ShotDraft>(shots: T[], scenes: ScriptSceneDraft[]): T[] {
    return shots.map((shot) => {
        const sceneId = shot.sceneId ? resolveSceneId(shot.sceneId, scenes) : undefined;
        const nextSceneId = sceneId ?? inferShotSceneId(shot, scenes) ?? shot.sceneId;
        return nextSceneId ? { ...shot, sceneId: nextSceneId } : shot;
    });
}
