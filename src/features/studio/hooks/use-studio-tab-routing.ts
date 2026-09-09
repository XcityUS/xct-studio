import type { StudioTab } from '@/features/studio/components/StudioWorkspace/types';
import { studioPath, studioTabFromPathname } from '@/features/studio/routing';
import type { AppLocale } from '@/i18n/routing';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

export function useStudioTabRouting(locale: AppLocale) {
    const pathname = usePathname();
    const router = useRouter();
    const activeTab = studioTabFromPathname(pathname);
    const navigateToTab = React.useCallback(
        (tab: StudioTab) => {
            if (tab !== activeTab) router.push(studioPath(locale, tab));
        },
        [activeTab, locale, router]
    );

    return { activeTab, navigateToTab };
}
