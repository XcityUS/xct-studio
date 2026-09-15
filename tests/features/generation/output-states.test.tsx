import { makeJob, makeShareItem, renderLocalized } from './fixtures';
import { VideoOutput } from '@/features/generation/components/VideoOutput';
import { StatusBadge } from '@/features/generation/components/VideoOutput/StatusBadge';
import type { VideoOutputProps } from '@/features/generation/components/VideoOutput/types';
import type { VideoJob } from '@/shared/contracts/video';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/generation/components/VideoOutput/hooks', () => ({ useDisplayProgress: () => 42 }));

const render = (props: Partial<VideoOutputProps> = {}, locale: 'en' | 'zh' = 'en') =>
    renderLocalized(<VideoOutput job={null} videoSrc={null} isLoading={false} {...props} />, locale);

describe('localized output lifecycle', () => {
    it.each([
        ['en', 'Video Output', 'No video job started yet', 'Submit a prompt to create your first video'],
        ['zh', '视频输出', '尚未开始视频生成任务', '提交提示词，创作你的第一个视频']
    ] as const)('renders %s empty-state copy', (locale, ...copy) => {
        const html = render({}, locale);
        for (const text of copy) expect(html).toContain(text);
        expect(html).not.toContain('<video');
        expect(html).not.toContain('role="status"');
    });

    it.each(['en', 'zh'] as const)('keeps initializing and empty states mutually exclusive in %s', (locale) => {
        const html = render({ isLoading: true }, locale);
        expect(html).toContain(locale === 'en' ? 'Initializing video generation...' : '正在初始化视频生成...');
        expect(html).not.toContain('No video job started yet');
        expect(html).not.toContain('尚未开始视频生成任务');
    });

    it.each([
        ['queued', 'Queued', '排队中'],
        ['in_progress', 'Processing 42%', '处理中 42%'],
        ['completed', 'Completed', '已完成'],
        ['failed', 'Failed', '失败']
    ] as const)('localizes the %s status without translating the status code', (status, english, chinese) => {
        expect(renderLocalized(<StatusBadge status={status} progress={42} />)).toContain(english);
        expect(renderLocalized(<StatusBadge status={status} progress={42} />, 'zh')).toContain(chinese);
        expect(renderLocalized(<StatusBadge status={status} progress={42} />, 'zh')).toContain(
            `data-status="${status}"`
        );
    });

    it.each(['queued', 'in_progress'] as const)(
        'hides real-job metadata while %s is a temporary submission',
        (status) => {
            const job = makeJob({ id: 'temp_submission', status });
            const html = render({ job }, 'zh');
            expect(html).toContain('正在向 Xcity TokenHub 发送请求...');
            expect(html).not.toContain(job.model);
            expect(html).not.toContain('Original user prompt');
            expect(html).not.toContain('<dl');
        }
    );

    it.each(['queued', 'in_progress', 'failed'] as const)(
        'preserves prompt/model/parameters in %s regardless of UI language',
        (status) => {
            const job: VideoJob = Object.freeze(makeJob({ status, progress: 42 }));
            for (const locale of ['en', 'zh'] as const) {
                const html = render({ job }, locale);
                expect(html).toContain('Original user prompt: {hero} &lt;close-up&gt;');
                expect(html).toContain(job.model);
                expect(html).toContain(job.size);
                expect(html).toContain(locale === 'en' ? '>5s<' : '>5 秒<');
                expect(html.match(/<dl/g)).toHaveLength(1);
            }
            expect(job.prompt).toBe('Original user prompt: {hero} <close-up>');
        }
    );

    it.each([
        [{ previewUnavailable: true }, 'Preview unavailable', '预览不可用', true],
        [{ isPreviewResolving: true }, 'Render complete', '渲染完成', false],
        [{}, 'Preview source missing', '缺少预览源', true]
    ] as const)('renders the correct completed-job recovery state', (state, english, chinese, retry) => {
        for (const locale of ['en', 'zh'] as const) {
            const html = render({ job: makeJob(), onRetryPreview: vi.fn(), ...state }, locale);
            expect(html).toContain(locale === 'en' ? english : chinese);
            expect(html.includes(locale === 'en' ? '>Retry<' : '>重试<')).toBe(retry);
            expect(html).not.toContain('<video');
        }
    });

    it('lets an unavailable preview win over a resolving flag and localizes poster alt text', () => {
        const html = render(
            { job: makeJob(), previewUnavailable: true, isPreviewResolving: true, thumbnailSrc: '/logo.png' },
            'zh'
        );
        expect(html).toContain('预览不可用');
        expect(html).not.toContain('渲染完成');
        expect(html).toContain('alt="视频首帧"');
    });

    it.each(['en', 'zh'] as const)('never renders an expired media URL as playable in %s', (locale) => {
        const html = render(
            { job: makeJob(), videoSrc: '/expired.mp4', mediaExpired: true, onFinalize: vi.fn() },
            locale
        );
        expect(html).toContain(locale === 'en' ? 'Media no longer available' : '媒体已不可用');
        expect(html).toContain(
            locale === 'en' ? 'Review settings and generate a paid final version' : '检查设置并付费生成正式版'
        );
        expect(html).not.toContain('<video');
    });
});

describe('completed output controls', () => {
    it('hides subtitle downloads when the completed video has no SRT track', () => {
        const html = render(
            {
                job: makeJob(),
                videoSrc: '/fixture.mp4',
                onDownload: vi.fn(),
                shareItem: makeShareItem({ storedUrl: '/fixture.mp4' })
            },
            'zh'
        );

        expect(html).toContain('>下载<');
        expect(html).not.toContain('下载字幕');
        expect(html).not.toContain('字幕视频');
    });

    it.each(['en', 'zh'] as const)(
        'renders localized player and action labels in %s without invoking actions',
        (locale) => {
            const action = vi.fn();
            const html = render(
                {
                    job: makeJob(),
                    videoSrc: '/local-fixture.mp4',
                    onDownload: action,
                    onExtend: action,
                    onSendToRemix: action,
                    onFinalize: action,
                    onShare: action,
                    shareItem: makeShareItem({ storedUrl: '/local-fixture.mp4' })
                },
                locale
            );
            const copy =
                locale === 'en'
                    ? ['Video player', 'Download', 'Extend', 'Finalize', 'Share', 'Send to Remix']
                    : ['视频播放器', '下载', '续拍', '生成正式版', '分享', '用于再创作'];
            for (const text of copy) expect(html).toContain(text);
            expect(html).toContain('data-player="artplayer"');
            expect(html).not.toContain('<video');
            expect(action).not.toHaveBeenCalled();
        }
    );

    it('preserves pending and disabled reasons after translation', () => {
        const html = render(
            {
                job: makeJob(),
                videoSrc: '/fixture.mp4',
                onExtend: vi.fn(),
                isExtendPending: true,
                onFinalize: vi.fn(),
                finalizeDisabledReason: 'Finalize is only available for Seedance 2.5 drafts.',
                onShare: vi.fn(),
                shareItem: makeShareItem()
            },
            'zh'
        );
        expect(html).toContain('正在准备...');
        expect(html).toContain('title="仅 Seedance 2.5 草稿支持生成正式版。"');
        expect(html).toContain('title="请稍候，先归档到云端"');
        expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(3);
    });

    it('keeps share pending disabled even when the clip is archived', () => {
        const html = render(
            {
                job: makeJob(),
                videoSrc: '/fixture.mp4',
                onShare: vi.fn(),
                isSharePending: true,
                shareItem: makeShareItem({ storedUrl: '/fixture.mp4' })
            },
            'zh'
        );
        expect(html).toContain('title="分享此视频"');
        expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(1);
    });

    it('shows persisted audio-to-caption alignment results', () => {
        const shareItem = makeShareItem({
            storedUrl: '/fixture.mp4',
            captionTrack: {
                mode: 'bilingual-en-zh',
                delivery: 'burned',
                status: 'completed',
                source: 'transcription-aligned-script',
                cues: [],
                expectedDialogueCount: 12,
                matchedDialogueCount: 11,
                transcriptSegmentCount: 11
            }
        });
        const html = render({ job: makeJob(), videoSrc: '/fixture.mp4', shareItem }, 'zh');
        expect(html).toContain('字幕已烧录：实际发音匹配 11/12 句');
    });

    it('loads completed automatic captions as a player subtitle track', () => {
        const shareItem = makeShareItem({
            storedUrl: '/fixture.mp4',
            captionTrack: {
                mode: 'bilingual-en-zh',
                delivery: 'player',
                status: 'completed',
                source: 'transcription-aligned-script',
                cues: [{ id: 'cue-1', startMs: 1000, endMs: 2000, english: 'Hello!', chinese: '你好！' }],
                expectedDialogueCount: 1,
                matchedDialogueCount: 1,
                transcriptSegmentCount: 1
            }
        });
        const html = render({ job: makeJob(), videoSrc: '/fixture.mp4', shareItem }, 'zh');

        expect(html).toContain('自动字幕已生成：共 1 句对白');
        expect(html).toContain('下载字幕');
        expect(html).toContain('字幕视频');
        expect(html).toContain('download="local-output-fixture.srt"');
        expect(html).toContain('data:text/plain;charset=utf-8');
    });

    it('restores a missing automatic subtitle track from an older completed item', () => {
        const shareItem = makeShareItem({
            status: 'completed',
            storedUrl: '/fixture.mp4',
            prompt: 'compiled provider prompt',
            createParams: {
                model: 'seedance-1-5-pro-251215',
                ratio: '16:9',
                resolution: '480p',
                seconds: 30,
                prompt: 'compiled provider prompt',
                caption_source_prompt: '妹妹：你好！\nSister: Hello!',
                caption_mode: 'auto-bilingual-en-zh',
                voice_language: 'en-US',
                generate_audio: true
            }
        });
        const html = render({ job: makeJob({ seconds: '30' }), videoSrc: '/fixture.mp4', shareItem }, 'zh');

        expect(html).toContain('自动字幕已生成：共 1 句对白');
        expect(html).toContain('下载字幕');
        expect(html).toContain('字幕视频');
        expect(html).toContain('data:text/plain;charset=utf-8');
    });
});
