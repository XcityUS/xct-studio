import { SiteShell } from '@/components/layout/SiteShell';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type LocaleLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    const t = await getTranslations({ locale });

    return {
        title: t('Xcity Video Studio'),
        description: t('Create AI videos and build your short<dash>drama productions with Xcity Studio')
    };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();

    return <SiteShell locale={locale}>{children}</SiteShell>;
}
