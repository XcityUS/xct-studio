import type { ScreenwritingCapability, ScreenwritingStage } from '../types';

const capability = (
    sourceId: string,
    title: string,
    stages: ScreenwritingStage[],
    role: 'overlap' | 'supplement',
    overlapsWith?: string[]
): ScreenwritingCapability => ({
    id: `inkos:${sourceId}`,
    source: 'inkos',
    sourceId,
    title,
    stages,
    role,
    defaultEnabled: false,
    ...(overlapsWith ? { overlapsWith } : {})
});

// Overlapping InkOS skills remain visible for source coverage, but routing uses
// the canonical screenwriting capability so two rule sets do not compete.
export const INKOS_CAPABILITIES: ScreenwritingCapability[] = [
    capability('inkos-long-story-analysis', '长篇故事分析', ['story', 'review'], 'overlap', [
        'screenwriting:sw-story-structure',
        'screenwriting:sw-character-conflict'
    ]),
    capability('inkos-long-writing', '长篇写作', ['story', 'scene'], 'overlap', [
        'screenwriting:sw-workflow',
        'screenwriting:sw-scene-craft'
    ]),
    capability('inkos-script-writing', '剧本写作', ['story', 'scene', 'dialogue'], 'overlap', [
        'screenwriting:sw-format-adaptation',
        'screenwriting:sw-dialogue'
    ]),
    capability('inkos-short-story-analysis', '短篇故事分析', ['story', 'review'], 'overlap', [
        'screenwriting:sw-premise-theme',
        'screenwriting:sw-story-structure'
    ]),
    capability('inkos-short-writing', '短篇写作', ['story', 'scene'], 'overlap', [
        'screenwriting:sw-story-structure',
        'screenwriting:sw-scene-craft'
    ]),
    capability('inkos-story-review', '故事审查', ['review'], 'overlap', ['screenwriting:sw-workflow']),
    capability('inkos-storyboard', '分镜创作', ['storyboard'], 'overlap', [
        'screenwriting:sw-scene-craft',
        'screenwriting:sw-writers-room'
    ]),
    capability('inkos-interactive-film', '互动影游', ['story', 'delivery'], 'supplement'),
    capability('inkos-long-market-research', '长篇市场研究', ['brief', 'delivery'], 'supplement'),
    capability('inkos-play-world', '开放世界', ['story', 'character'], 'supplement'),
    capability('inkos-short-market-research', '短篇市场研究', ['brief', 'delivery'], 'supplement'),
    capability('inkos-story-cover', '故事封面', ['delivery'], 'supplement'),
    capability('inkos-story-deslop', '去 AI 味', ['dialogue', 'review'], 'supplement'),
    capability('inkos-story-import', '故事导入', ['brief', 'story'], 'supplement'),
    capability('inkos-translation', '翻译与本地化', ['delivery'], 'supplement')
];
