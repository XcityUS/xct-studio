import { routing } from './i18n/routing';
import createMiddleware from 'next-intl/middleware';

export default createMiddleware(routing);

export const config = {
    // Legacy page URLs gain the default locale; API and media URLs stay untouched.
    matcher: ['/', '/portrait-callback', '/(zh|en)/:path*']
};
