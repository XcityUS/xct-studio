import type { StudioTab } from './components/StudioWorkspace/types';
import type { AppLocale } from '@/i18n/routing';

export const STUDIO_TABS = ['video', 'image', 'assets', 'community'] as const satisfies readonly StudioTab[];

export function isStudioTab(value: string): value is StudioTab {
    return STUDIO_TABS.some((tab) => tab === value);
}

export function studioTabFromPathname(pathname: string): StudioTab {
    const surface = pathname.split('/').filter(Boolean).at(-1) ?? '';
    return isStudioTab(surface) ? surface : 'video';
}

export function studioPath(locale: AppLocale, tab: StudioTab): string {
    return `/${locale}/${tab}`;
}
