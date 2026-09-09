import { isStudioTab } from '@/features/studio/routing';
import { notFound } from 'next/navigation';

type StudioSurfaceProps = {
    params: Promise<{ surface: string }>;
};

export default async function StudioSurface({ params }: StudioSurfaceProps) {
    const { surface } = await params;
    if (!isStudioTab(surface)) notFound();

    return null;
}
