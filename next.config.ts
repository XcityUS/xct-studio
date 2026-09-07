import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
    distDir: process.env.NEXT_DIST_DIR ?? '.next'
};

export default withNextIntl(nextConfig);
