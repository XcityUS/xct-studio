import { NotFound } from '@/components/layout/NotFound';
import { SiteShell } from '@/components/layout/SiteShell';
import { getLocale } from 'next-intl/server';

export default async function NotFoundPage() {
    return (
        <SiteShell locale={await getLocale()}>
            <NotFound />
        </SiteShell>
    );
}
