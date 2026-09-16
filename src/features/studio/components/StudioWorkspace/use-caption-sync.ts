import { providerLinkLikelyDead } from '@/features/assets/media/state';
import { renderAlignedCaptions } from '@/features/post-production/captions/process';
import { captionDelivery, captionLanguage, normalizeVoiceLanguage } from '@/features/script/prompt/guards';
import { transcribeVideo } from '@/lib/captions';
import { transcribeModel } from '@/lib/media-archive';
import type { VideoService } from '@/lib/video-service';
import type { VideoMetadata } from '@/shared/contracts/video';
import { InvalidApiKeyError } from '@/shared/errors';
import * as React from 'react';

type Options = {
    history: VideoMetadata[];
    getVideoSrc: (videoId: string) => string | null | undefined;
    videoService: VideoService;
    resolveKey: () => Promise<string | null>;
    updateItem: (id: string, patch: Partial<VideoMetadata>) => void;
    syncNow: () => Promise<unknown>;
    setOutputError: (message: string | null) => void;
    onInvalidApiKey: () => void;
};

export function useCaptionSync({
    history,
    getVideoSrc,
    videoService,
    resolveKey,
    updateItem,
    syncNow,
    setOutputError,
    onInvalidApiKey
}: Options) {
    const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
    const transcribe = React.useCallback(
        async (film: Blob) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai to generate captions.');
            const model = await transcribeModel();
            if (!model) throw new Error('Auto-captioning is not configured on this deployment.');
            return transcribeVideo(film, key, model, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        },
        [resolveKey]
    );

    const syncCaptions = React.useCallback(
        async (videoId: string) => {
            const item = history.find((candidate) => candidate.id === videoId);
            const mode = captionLanguage(item?.createParams?.caption_mode);
            const delivery = captionDelivery(item?.createParams?.caption_mode);
            const sourceUrl =
                getVideoSrc(videoId) ??
                item?.storedUrl ??
                (item?.providerUrl && !providerLinkLikelyDead(item, Date.now()) ? item.providerUrl : undefined);
            if (!item || !mode || delivery !== 'player' || !sourceUrl) {
                setOutputError('A playable video and player subtitle mode are required to sync captions.');
                return;
            }

            setPendingIds((previous) => new Set(previous).add(videoId));
            setOutputError(null);
            try {
                const film = await videoService.downloadContent(videoId, sourceUrl);
                const result = await renderAlignedCaptions(film, {
                    mode,
                    delivery: 'player',
                    prompt: item.createParams?.caption_source_prompt ?? item.createParams?.prompt ?? item.prompt,
                    voiceLanguage: normalizeVoiceLanguage(item.createParams?.voice_language),
                    transcribe
                });
                if (result.track.status !== 'completed') {
                    throw new Error(result.track.warning || 'Could not align subtitles with the generated audio.');
                }
                updateItem(videoId, { captionTrack: result.track });
                await syncNow();
            } catch (error) {
                if (error instanceof InvalidApiKeyError) onInvalidApiKey();
                setOutputError(error instanceof Error ? error.message : 'Could not sync subtitles.');
            } finally {
                setPendingIds((previous) => {
                    const next = new Set(previous);
                    next.delete(videoId);
                    return next;
                });
            }
        },
        [getVideoSrc, history, onInvalidApiKey, setOutputError, syncNow, transcribe, updateItem, videoService]
    );

    return { pendingIds, syncCaptions, transcribe };
}
