import { makeJob, renderLocalized } from './fixtures';
import { VideoOutput } from '@/features/generation/components/VideoOutput';
import { useOutputMessages } from '@/features/generation/components/VideoOutput/messages';
import { sanitizeStudioErrorMessage } from '@/shared/errors';
import { describe, expect, it } from 'vitest';

function ErrorCopy({ message }: { message: string | null }) {
    const copy = useOutputMessages();
    return <p>{copy.error(message)}</p>;
}

describe('legacy output error localization', () => {
    const cases = [
        ['API key budget has been exceeded', 'API 密钥预算已用完。'],
        ['API key budget has been exceeded. Current cost: 12.50, max budget: 10.', '当前用量：12.50，预算上限：10。'],
        ['received a 200x100px image', '当前图片为 200 x 100 像素。'],
        ['height to be at least 300px', '参考图片的宽高均须在 300 至 6000 像素之间。'],
        ['ratio adaptive', '此参考视频任务需要自适应画幅和原视频时长'],
        ['resource download failed', '工作台无法加载参考视频'],
        ['InvalidParameter image_url', '工作台无法使用参考图片'],
        ['BytePlus provider request id internal-debug', '工作台无法完成此请求'],
        ['Finalize is only available for Seedance 2.5 drafts.', '仅 Seedance 2.5 草稿支持生成正式版。']
    ];

    it.each(cases)('localizes sanitized error %s', (raw, chinese) => {
        const sanitized = sanitizeStudioErrorMessage(raw);
        expect(renderLocalized(<ErrorCopy message={sanitized} />, 'zh')).toContain(chinese);
        expect(renderLocalized(<ErrorCopy message={sanitized} />)).toBe(`<p>${sanitized}</p>`);
    });

    it('keeps empty errors empty', () => {
        expect(renderLocalized(<ErrorCopy message={null} />, 'zh')).toBe('<p></p>');
    });

    it('does not consume sentence punctuation as part of the budget amount', () => {
        const once = sanitizeStudioErrorMessage(
            'API key budget has been exceeded. Current cost: 12.50, max budget: 10.'
        );
        expect(once).toBe('The API key budget has been exceeded. Current cost: 12.50, max budget: 10.');
        expect(sanitizeStudioErrorMessage(once)).toBe(once);
    });

    it('does not pass an unrecognized runtime string or translation-shaped input into t()', () => {
        expect(renderLocalized(<ErrorCopy message='Video Output' />, 'zh')).toBe('<p>Video Output</p>');
        expect(renderLocalized(<ErrorCopy message='unexpected {serverKey} <script>' />, 'zh')).toBe(
            '<p>unexpected {serverKey} &lt;script&gt;</p>'
        );
    });

    it.each(['en', 'zh'] as const)('keeps billing eligibility independent of translated error text in %s', (locale) => {
        const html = renderLocalized(
            <VideoOutput
                job={makeJob({ status: 'failed', error: { message: 'budget has been exceeded' } })}
                videoSrc={null}
                isLoading={false}
                error='rate-limited: higher RPM required'
            />,
            locale
        );
        expect(html.match(/href="https:\/\/xcity.ai\/dashboard\/billing"/g)).toHaveLength(2);
        expect(html).toContain(locale === 'en' ? 'Video generation failed' : '视频生成失败');
    });

    it('sanitizes provider diagnostics before rendering and does not offer billing for unrelated failures', () => {
        const html = renderLocalized(
            <VideoOutput
                job={makeJob({ status: 'failed', error: { message: 'BytePlus provider request id internal-debug' } })}
                videoSrc={null}
                isLoading={false}
            />,
            'zh'
        );
        expect(html).toContain('工作台无法完成此请求');
        expect(html).not.toContain('internal-debug');
        expect(html).not.toContain('/dashboard/billing');
    });
});
