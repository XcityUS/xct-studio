import { BRANDING_WATERMARK_TEXT, MAX_WATERMARK_TEXT_LENGTH } from './constants';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { refKey, type ReferenceDeclaration, type ReferenceOrigin } from '@/features/assets/reference/origin';
import { RATIOS, RESOLUTIONS, getSeedanceModel, type VideoRatio, type VideoResolution } from '@/shared/config/seedance';
import type { VideoJobCreate } from '@/shared/contracts/video';

export function fileNameWithoutExtension(fileName: string): string {
    const clean = fileName.trim();
    const dot = clean.lastIndexOf('.');
    return dot > 0 ? clean.slice(0, dot) : clean;
}

export function voiceoverAssetName(text: string): string {
    const firstWords = text.trim().replace(/\s+/g, ' ').split(' ').slice(0, 5).join(' ');
    const safeWords = firstWords
        .replace(/[\/\\?%*:|"<>]/g, '')
        .slice(0, 60)
        .trim();
    return safeWords ? `voiceover-${safeWords}` : 'voiceover';
}

export function realPersonReferenceErrorMessage(canVerify: boolean): string {
    return canVerify
        ? 'Studio blocked a raw reference image that appears to contain a real person. If this is an AI character, mark it as AI-generated and create a Virtual asset first; if it is a real person, use Assets → Verified people and attach the verified asset.'
        : 'Studio blocked a raw reference image that appears to contain a real person. If this is an AI character, mark it as AI-generated and create a Virtual asset first; real-person references require the verified-people library to be enabled by the Xcity admin.';
}

export function isVideoResolution(value: string | undefined): value is VideoResolution {
    return Boolean(value && RESOLUTIONS.includes(value as VideoResolution));
}

export function isVideoRatio(value: string | undefined): value is VideoRatio {
    return Boolean(value && RATIOS.includes(value as VideoRatio));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeWatermarkText(text: string | undefined) {
    const normalized = (text ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_WATERMARK_TEXT_LENGTH);
    return normalized || BRANDING_WATERMARK_TEXT;
}

export function stableTextHash(text: string) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function watermarkedVideoId(videoId: string, text: string) {
    return `${videoId}-wm-${stableTextHash(normalizeWatermarkText(text))}`;
}

export function legacyWatermarkedVideoId(videoId: string) {
    return `${videoId}-branded`;
}

export function isVideoJobCreateParams(value: unknown): value is VideoJobCreate {
    if (!isRecord(value)) return false;
    return (
        typeof value.prompt === 'string' &&
        typeof value.model === 'string' &&
        Boolean(getSeedanceModel(value.model)) &&
        typeof value.ratio === 'string' &&
        isVideoRatio(value.ratio) &&
        typeof value.resolution === 'string' &&
        isVideoResolution(value.resolution) &&
        typeof value.seconds === 'number' &&
        typeof value.generate_audio === 'boolean'
    );
}

export function imageReferenceUrlsFromParams(params: VideoJobCreate): string[] {
    const refs = params.reference_image_urls ?? (params.input_reference_url ? [params.input_reference_url] : []);
    const lastFrame = params.last_frame_url?.trim();
    return [...refs, ...(lastFrame ? [lastFrame] : [])].map((url) => url.trim()).filter(Boolean);
}

export function withPortraitDeclarations(
    declarations: Record<string, ReferenceDeclaration>,
    portraits: {
        assetId: string;
        groupId: string;
        groupType: 'LivenessFace' | 'AIGC';
        status: 'Processing' | 'Active' | 'Failed';
        thumbUrl: string;
        referenceOrigin?: ReferenceOrigin;
    }[]
): Record<string, ReferenceDeclaration> {
    const next = { ...declarations };
    for (const portrait of portraits) {
        if (portrait.status !== 'Active') continue;
        const assetId = portrait.assetId.trim();
        const groupId = portrait.groupId.trim();
        if (!assetId || !groupId) continue;

        const key = refKey(portraitReferenceUrl(assetId));
        if (!key) continue;
        const sourceDeclaration = declarations[refKey(portrait.thumbUrl)];
        const existing = next[key];
        next[key] = {
            ...(existing ?? {}),
            origin:
                portrait.referenceOrigin ??
                sourceDeclaration?.origin ??
                (portrait.groupType === 'AIGC' ? 'thirdparty-ai' : 'real-person'),
            declaredAt: existing?.declaredAt ?? 0,
            assetId,
            groupId
        };
    }
    return next;
}
