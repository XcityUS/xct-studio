import type { ScreenwritingCapability, ScreenwritingStage } from '../types';

const capability = (
    sourceId: string,
    title: string,
    stages: ScreenwritingStage[],
    defaultEnabled = false
): ScreenwritingCapability => ({
    id: `screenwriting:${sourceId}`,
    source: 'screenwriting-skills',
    sourceId,
    title,
    stages,
    role: 'canonical',
    defaultEnabled
});

// Capability metadata is original XCT Studio routing data. It intentionally does
// not copy third-party skill instructions or reference texts into the runtime.
export const SCREENWRITING_CAPABILITIES: ScreenwritingCapability[] = [
    capability('sw-workflow', '编剧工作流', ['brief', 'story', 'review', 'delivery'], true),
    capability('sw-premise-theme', '前提与主题', ['brief', 'story', 'review'], true),
    capability('sw-story-structure', '故事结构', ['story', 'series', 'review'], true),
    capability('sw-character-conflict', '人物与冲突', ['character', 'scene', 'review'], true),
    capability('sw-dialogue', '对白', ['dialogue', 'scene', 'storyboard', 'review'], true),
    capability('sw-scene-craft', '场景设计', ['scene', 'storyboard', 'review'], true),
    capability('sw-format-adaptation', '格式与改编', ['story', 'delivery'], true),
    capability('sw-truby-anatomy', '有机故事结构', ['story', 'character', 'review']),
    capability('sw-series-structure', '单集与季结构', ['series', 'story', 'review'], true),
    capability('sw-series-engine-bible', '剧集引擎与故事圣经', ['brief', 'series', 'character'], true),
    capability('sw-writers-room', '编剧室与制作约束', ['story', 'scene', 'storyboard', 'review'], true),
    capability('sw-sitcom-comedy', '情景喜剧', ['story', 'scene', 'dialogue']),
    capability('sw-chinese-series-practice', '国产剧创作实践', ['brief', 'series', 'story', 'delivery'], true),
    capability('sw-american-case-studies', '美国电影案例', ['story', 'review']),
    capability('sw-japanese-screenwriting', '日本编剧方法', ['story', 'scene', 'dialogue']),
    capability('sw-korean-french-screenwriting', '韩国与法国编剧方法', ['story', 'scene', 'dialogue']),
    capability('sw-industry-business', '行业与商业判断', ['brief', 'delivery']),
    capability('sw-series-case-studies', '剧集案例库', ['series', 'story', 'review']),
    capability('chekhov-dramaturgy', '契诃夫戏剧法', ['story', 'scene', 'dialogue']),
    capability('ozu-screenplay-style', '小津剧本风格', ['story', 'scene', 'dialogue', 'storyboard']),
    capability('succession-series-writing', '群像剧写法', ['series', 'character', 'scene', 'dialogue']),
    capability('sw-chinese-opera-banqiang', '板腔体戏曲方法', ['story', 'scene', 'dialogue', 'delivery']),
    capability('sw-chinese-opera-banqiang-cases', '板腔体案例', ['story', 'scene', 'review']),
    capability('sw-chinese-opera-qupai', '曲牌体戏曲方法', ['story', 'scene', 'dialogue', 'delivery']),
    capability('sw-chinese-opera-qupai-cases', '曲牌体案例', ['story', 'scene', 'review'])
];
