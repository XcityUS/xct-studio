import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import type { PortraitSetupCompletion, PortraitSetupRequest } from '@/features/assets/portrait/setup-flow';
import type { ReferenceDeclaration } from '@/features/assets/reference/origin';
import type { StudioTab } from '@/features/studio/components/StudioWorkspace/types';
import * as React from 'react';

type Options = {
    declarations: Record<string, ReferenceDeclaration>;
    navigateToTab: (tab: StudioTab) => void;
    scrollToCreationForm: () => Promise<void>;
    setDeclaration: (key: string, declaration: ReferenceDeclaration) => void;
    setReferenceUrls: React.Dispatch<React.SetStateAction<string[]>>;
};

export function usePortraitSetupFlow({
    declarations,
    navigateToTab,
    scrollToCreationForm,
    setDeclaration,
    setReferenceUrls
}: Options) {
    const [pendingPortraitSetup, setPendingPortraitSetup] = React.useState<PortraitSetupRequest | null>(null);

    const openAssets = React.useCallback(
        (request?: PortraitSetupRequest) => {
            setPendingPortraitSetup(request ?? null);
            navigateToTab('assets');
        },
        [navigateToTab]
    );

    const completePortraitSetup = React.useCallback(
        (completion: PortraitSetupCompletion) => {
            const assetUrl = portraitReferenceUrl(completion.assetId);
            setReferenceUrls((current) => current.map((url) => (url === completion.sourceUrl ? assetUrl : url)));
            setDeclaration(completion.referenceKey, {
                ...(declarations[completion.referenceKey] ?? {}),
                origin: 'real-person',
                declaredAt: Date.now(),
                assetId: completion.assetId,
                groupId: completion.groupId
            });
            setPendingPortraitSetup(null);
            navigateToTab('video');
            void scrollToCreationForm();
        },
        [declarations, navigateToTab, scrollToCreationForm, setDeclaration, setReferenceUrls]
    );

    return { completePortraitSetup, openAssets, pendingPortraitSetup };
}
