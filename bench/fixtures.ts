/**
 * Deterministic fixtures for the benchmark suite.
 *
 * Benchmarks must not depend on Math.random or Date.now: the same input has to
 * be measured on every run, otherwise CodSpeed compares different workloads.
 */
import type { CaptionSegment } from '@/lib/captions';
import type { HistoryDoc, VideoCharacter, VideoPortrait } from '@/lib/history-merge';
import type { Fcp7XmlClip } from '@/lib/nle-export';
import type { ReferenceDeclaration } from '@/lib/reference-origin';
import type { VideoMetadata } from '@/types/video';

const BASE_TIMESTAMP = 1_740_000_000_000;
const RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'] as const;
const RESOLUTIONS = ['480p', '720p', '1080p'] as const;
const MODELS = [
    'seedance-1-5-pro-251215',
    'dreamina-seedance-2-0-260128',
    'dreamina-seedance-2-0-fast-260128'
] as const;

/** Small xorshift so fixtures are varied but reproducible across runs. */
export function makeRng(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        return state / 0xffffffff;
    };
}

export function makeHistoryItem(index: number, overrides: Partial<VideoMetadata> = {}): VideoMetadata {
    const ratio = RATIOS[index % RATIOS.length];
    const resolution = RESOLUTIONS[index % RESOLUTIONS.length];

    return {
        id: `video-${index}`,
        timestamp: BASE_TIMESTAMP + index * 1000,
        updatedAt: BASE_TIMESTAMP + index * 1000 + 500,
        filename: `xcity-${index}.mp4`,
        durationMs: 42_000 + (index % 17) * 1000,
        model: MODELS[index % MODELS.length],
        size: `${ratio} · ${resolution}`,
        seconds: 4 + (index % 9),
        prompt: `Wide cinematic shot number ${index} of a neon-lit street at night, slow dolly-in, volumetric light.`,
        mode: index % 5 === 0 ? 'remix' : 'create',
        status: 'completed',
        storedUrl: index % 3 === 0 ? `https://media.xcity.one/media/u/user-1/vid/${index}.mp4` : undefined,
        providerUrl: `https://ark-cdn.example.com/${index}.mp4?X-Tos-Date=20250101T000000Z&X-Tos-Expires=86400`,
        costDetails: null,
        ...overrides
    };
}

export function makeCharacters(count: number, offset = 0): VideoCharacter[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `character-${offset + i}`,
        name: `Character ${offset + i}`,
        url: `https://media.xcity.one/media/u/user-1/refs/${(offset + i).toString(16).padStart(32, '0')}.png`
    }));
}

export function makePortraits(count: number, offset = 0): VideoPortrait[] {
    return Array.from({ length: count }, (_, i) => ({
        assetId: `asset-${offset + i}`,
        groupId: `group-${(offset + i) % 7}`,
        groupType: (offset + i) % 2 === 0 ? 'LivenessFace' : 'AIGC',
        name: `Portrait ${offset + i}`,
        thumbUrl: `https://media.xcity.one/media/u/user-1/thumbs/${offset + i}.jpg`
    }));
}

export function makeDeclarations(count: number, offset = 0): Record<string, ReferenceDeclaration> {
    const declarations: Record<string, ReferenceDeclaration> = {};
    for (let i = 0; i < count; i += 1) {
        declarations[`ref-${offset + i}`] = {
            origin: (offset + i) % 2 === 0 ? 'no-person' : 'thirdparty-ai',
            declaredAt: BASE_TIMESTAMP + (offset + i) * 100,
            assetId: `asset-${offset + i}`
        };
    }
    return declarations;
}

/**
 * Two devices that overlap on half their history — the case the merge rules
 * actually exist for (union by id, tombstones, rank/version tie-breaks).
 */
export function makeDocPair(size: number): { local: HistoryDoc; remote: HistoryDoc } {
    const overlap = Math.floor(size / 2);

    const local: HistoryDoc = {
        updatedAt: BASE_TIMESTAMP + 10_000,
        history: Array.from({ length: size }, (_, i) => makeHistoryItem(i)),
        characters: makeCharacters(60),
        portraits: makePortraits(60),
        declarations: makeDeclarations(300),
        deletedIds: Array.from({ length: 120 }, (_, i) => `video-deleted-local-${i}`)
    };

    const remote: HistoryDoc = {
        updatedAt: BASE_TIMESTAMP + 5_000,
        history: Array.from({ length: size }, (_, i) =>
            makeHistoryItem(overlap + i, {
                status: i % 4 === 0 ? 'processing' : 'completed',
                storedUrl: undefined
            })
        ),
        characters: makeCharacters(60, 30),
        portraits: makePortraits(60, 30),
        declarations: makeDeclarations(300, 150),
        deletedIds: Array.from({ length: 120 }, (_, i) => `video-deleted-remote-${i}`)
    };

    return { local, remote };
}

export function makeCaptionSegments(count: number): CaptionSegment[] {
    const rng = makeRng(7);
    return Array.from({ length: count }, (_, i) => {
        const start = i * 2.5 + rng() * 0.2;
        return {
            start,
            end: start + 2 + rng() * 0.4,
            text: `  Line ${i}: the narrator explains the shot, with trailing whitespace and a \r carriage return  `
        };
    });
}

export function makeClips(count: number): Fcp7XmlClip[] {
    return Array.from({ length: count }, (_, i) => ({
        name: i % 6 === 0 ? `Shot "${i}" <takes> & retakes` : `Shot ${i}`,
        url: `https://media.xcity.one/media/u/user-1/vid/${i}.mp4?token=a&b=c`,
        durationSeconds: 4 + (i % 9),
        width: i % 2 === 0 ? 1920 : 1080,
        height: i % 2 === 0 ? 1080 : 1920,
        inSeconds: (i % 3) * 0.5,
        outSeconds: 3 + (i % 8)
    }));
}
