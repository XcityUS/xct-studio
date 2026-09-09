import { getPathname } from '@/i18n/navigation';
import proxy, { config } from '@/proxy';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

describe('locale routing', () => {
    it('redirects root to Chinese and preserves incoming share parameters', () => {
        const request = new NextRequest('https://studio.example/?share=abc12345&tab=video', {
            headers: { 'accept-language': 'en', cookie: 'NEXT_LOCALE=en' }
        });
        const response = proxy(request);
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://studio.example/zh?share=abc12345&tab=video');
    });

    it.each(['zh', 'en'])('keeps the explicit %s locale without redirecting it', (locale) => {
        const response = proxy(new NextRequest(`https://studio.example/${locale}`));
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-request-x-next-intl-locale')).toBe(locale);
    });

    it('redirects the legacy callback to its single locale route without losing callback parameters', () => {
        const url = new URL('https://studio.example/portrait-callback');
        url.searchParams.set('resultCode', '10000');
        url.searchParams.set('bytedToken', 'test-token+/=&');
        url.searchParams.append('trace', 'first');
        url.searchParams.append('trace', 'second');
        const response = proxy(new NextRequest(url));
        const destination = new URL(response.headers.get('location')!);
        expect(response.status).toBe(307);
        expect(destination.pathname).toBe('/zh/portrait-callback');
        expect(destination.search).toBe(url.search);
    });

    it.each(['zh', 'en'])('does not redirect an already localized %s callback', (locale) => {
        const response = proxy(new NextRequest(`https://studio.example/${locale}/portrait-callback?resultCode=0`));
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-middleware-request-x-next-intl-locale')).toBe(locale);
    });

    it.each([
        '/',
        '/portrait-callback',
        '/zh',
        '/en',
        '/zh/video',
        '/en/assets',
        '/zh/portrait-callback',
        '/en/portrait-callback'
    ])('matches %s', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    });

    it.each([
        '/api/config',
        '/api/portrait/result',
        '/api/video-content',
        '/ffmpeg/ffmpeg-core.wasm',
        '/logo.png',
        '/_next/static/app.js',
        '/manifest.json',
        '/media/video.mp4',
        '/share/abc12345',
        '/download/video.mp4',
        '/fr'
    ])('leaves existing non-locale endpoint %s untouched', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    });

    it('builds localized links without discarding queries or fragments', () => {
        expect(getPathname({ locale: 'en', href: '/?tab=assets#selected' })).toBe('/en?tab=assets#selected');
        expect(getPathname({ locale: 'zh', href: '/portrait-callback?resultCode=10000' })).toBe(
            '/zh/portrait-callback?resultCode=10000'
        );
    });
});
