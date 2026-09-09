import { studioPath } from '@/features/studio/routing';
import type { AppLocale } from '@/i18n/routing';
import { redirect } from 'next/navigation';

type StudioIndexProps = {
    params: Promise<{ locale: AppLocale }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudioIndex({ params, searchParams }: StudioIndexProps) {
    const { locale } = await params;
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(await searchParams)) {
        if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
        else if (value !== undefined) query.set(key, value);
    }

    const suffix = query.size ? `?${query.toString()}` : '';
    redirect(`${studioPath(locale, 'video')}${suffix}`);
}
