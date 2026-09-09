import { StudioWorkspace } from '@/features/studio/components/StudioWorkspace';
import type { AppLocale } from '@/i18n/routing';

type StudioLayoutProps = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export default async function StudioLayout({ children, params }: StudioLayoutProps) {
    const { locale } = await params;

    return (
        <>
            <StudioWorkspace locale={locale as AppLocale} />
            {children}
        </>
    );
}
