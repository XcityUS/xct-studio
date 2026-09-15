import type { VideoPlayerProps } from '@/components/ui/VideoPlayer';
import { CompletedVideoPlayer } from '@/features/generation/components/VideoOutput/CompletedVideoPlayer';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const observed = vi.hoisted(() => ({ props: undefined as VideoPlayerProps | undefined }));

vi.mock('@/components/ui/VideoPlayer', () => ({
    aspectRatioFromSize: () => '16 / 9',
    VideoPlayer: (props: VideoPlayerProps) => {
        observed.props = props;
        return null;
    }
}));

describe('completed video subtitle track', () => {
    it('passes automatic caption cues to Artplayer as an SRT track', () => {
        renderToStaticMarkup(
            <CompletedVideoPlayer
                jobId='video-1'
                videoSrc='/video.mp4'
                size='16:9'
                captionTrack={{
                    mode: 'bilingual-en-zh',
                    delivery: 'player',
                    status: 'completed',
                    source: 'transcription-aligned-script',
                    cues: [{ id: 'cue-1', startMs: 1000, endMs: 2000, english: 'Hello!', chinese: '你好！' }],
                    expectedDialogueCount: 1,
                    matchedDialogueCount: 1,
                    transcriptSegmentCount: 1
                }}
            />
        );

        expect(observed.props?.subtitle?.type).toBe('srt');
        expect(observed.props?.subtitle?.url).toContain('data:text/plain;charset=utf-8');
        expect(observed.props?.instanceKey).toBe('video-1:subtitles');
    });
});
