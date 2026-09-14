import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';

export type ScreenwritingStage =
    | 'brief'
    | 'story'
    | 'character'
    | 'series'
    | 'scene'
    | 'dialogue'
    | 'storyboard'
    | 'review'
    | 'delivery';

export type CapabilitySource = 'screenwriting-skills' | 'inkos';
export type CapabilityRole = 'canonical' | 'overlap' | 'supplement';

export type ScreenwritingCapability = {
    id: string;
    source: CapabilitySource;
    sourceId: string;
    title: string;
    stages: ScreenwritingStage[];
    role: CapabilityRole;
    defaultEnabled: boolean;
    overlapsWith?: string[];
};

export type StoryboardFindingCode =
    | 'MISSING_DESCRIPTION'
    | 'INVALID_DURATION'
    | 'DIALOGUE_TOO_LONG'
    | 'UNKNOWN_DIALOGUE_SPEAKER'
    | 'UNKNOWN_CHARACTER_REFERENCE'
    | 'UNKNOWN_SCENE_REFERENCE'
    | 'INVALID_CONTINUITY_SOURCE'
    | 'UNBOUND_CHARACTER_ASSET'
    | 'UNBOUND_SCENE_ASSET'
    | 'ABSTRACT_VISUAL_DESCRIPTION'
    | 'HIGH_CAST_COMPLEXITY';

export type StoryboardFinding = {
    id: string;
    code: StoryboardFindingCode;
    severity: 'warning' | 'blocking';
    shotId: string;
    shotIndex: number;
    targetType?: 'character' | 'scene';
    targetLabel?: string;
    capabilityIds: string[];
    evidence?: string;
    details?: Record<string, string | number>;
};

export type StoryboardReviewInput = {
    draft: EditorDraft;
    minDurationSeconds: number;
    maxDurationSeconds: number;
};
