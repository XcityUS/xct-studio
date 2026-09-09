import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Textarea } from '@/components/ui/Textarea';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('SCSS Module controls', () => {
    it('preserves input native attributes and caller classes', () => {
        const html = renderToStaticMarkup(
            createElement(Input, {
                type: 'file',
                accept: 'image/*',
                multiple: true,
                disabled: true,
                name: 'references',
                className: 'consumer',
                'aria-invalid': true
            })
        );
        for (const part of [
            'type="file"',
            'accept="image/*"',
            'multiple=""',
            'disabled=""',
            'name="references"',
            'consumer',
            'aria-invalid="true"',
            'data-slot="input"'
        ])
            expect(html).toContain(part);
    });

    it('preserves textarea content and native constraints', () => {
        const html = renderToStaticMarkup(
            createElement(Textarea, {
                name: 'prompt',
                defaultValue: 'A scene <draft>',
                maxLength: 500,
                rows: 4,
                required: true,
                className: 'consumer'
            })
        );
        for (const part of [
            'name="prompt"',
            'maxLength="500"',
            'rows="4"',
            'required=""',
            'consumer',
            'data-slot="textarea"',
            'A scene &lt;draft&gt;'
        ])
            expect(html).toContain(part);
    });
});

describe('slider accessible labels', () => {
    it.each([{ 'aria-label': 'Video progress' }, { 'aria-labelledby': 'video-progress-label' }])(
        'forwards $aria-label $aria-labelledby to the actual interactive thumb',
        (label) => {
            const html = renderToStaticMarkup(createElement(Slider, { defaultValue: [0], max: 10, ...label }));
            const thumb = html.match(/<span\b[^>]*role="slider"[^>]*>/)?.[0];
            expect(thumb).toBeDefined();
            for (const [key, value] of Object.entries(label)) expect(thumb).toContain(`${key}="${value}"`);
        }
    );
});
