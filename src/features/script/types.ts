export type ShotDraft = {
    id?: string;
    description: string;
    prompt?: string;
    camera?: string;
    audio?: string;
    durationSeconds?: number;
    sceneId?: string;
    characterIds?: string[];
    characterSelectionMode?: 'manual';
    assetIds?: string[];
    dialogues?: ScriptDialogueDraft[];
    subtitle?: string;
    continuitySourceShotId?: string;
};

export type ScriptDialogueDraft = {
    speakerCharacterId?: string;
    text: string;
    emotion?: string;
};

export type ScriptCharacterDraft = {
    id: string;
    name: string;
    aliases: string[];
    description: string;
    evidence: string[];
    presence: 'on_screen' | 'voice_over' | 'narrator' | 'mentioned';
    major: boolean;
    assetId?: string;
};

export type ScriptSceneDraft = {
    id: string;
    name: string;
    description: string;
    evidence: string[];
    assetId?: string;
};

export type ScriptAnalysisDraft = {
    version: 1;
    characters: ScriptCharacterDraft[];
    scenes: ScriptSceneDraft[];
    shots: ShotDraft[];
};

export type ScriptFileExtraction = {
    filename: string;
    text: string;
};
