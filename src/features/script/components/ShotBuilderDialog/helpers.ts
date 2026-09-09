import type { ShotDraft } from '@/features/script/types';

export function createEmptyShot(durationSeconds: number): ShotDraft {
    return { description: '', durationSeconds };
}

function cleanAudioCue(audio: string): string {
    return audio
        .trim()
        .replace(/^\{+|\}+$/g, '')
        .trim();
}

export function compilePrompt(globalNote: string, shots: ShotDraft[]): string {
    const lines = shots
        .map((shot) => {
            const description = shot.description.trim();
            const camera = shot.camera?.trim();
            const audio = shot.audio ? cleanAudioCue(shot.audio) : '';

            let line = description;
            if (camera) line = line ? `${line}, ${camera}` : camera;
            if (audio) line = line ? `${line} {${audio}}` : `{${audio}}`;

            return line;
        })
        .filter(Boolean)
        .map((line, index) => `${index + 1}) ${line}`);

    return [globalNote.trim(), lines.join('\n')].filter(Boolean).join('\n');
}

export function appendImageToken(description: string, imageIndex: number): string {
    const token = `[Image ${imageIndex}]`;
    if (!description) return token;
    return `${description}${/\s$/.test(description) ? '' : ' '}${token}`;
}

export function isPresetCamera(camera: string, templates: readonly { text: string }[]): boolean {
    return templates.some((template) => template.text === camera);
}
