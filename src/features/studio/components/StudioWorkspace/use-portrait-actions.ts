import {
    createPortraitAsset,
    createPortraitGroup,
    createPortraitSession,
    deletePortraitGroup,
    fetchPortraitStatus,
    getPortraitAsset,
    listPortraitAssets,
    listPortraitGroups,
    type PortraitGroup,
    type PortraitGroupQueryType
} from '@/features/assets/portrait/api';
import type { useShortDramaProject } from '@/features/projects/hooks/use-short-drama-project';
import * as React from 'react';

type Options = {
    resolveKey: () => Promise<string | null>;
    apiKey: string | null;
    activeTab: string;
    isPortraitEnabled: boolean;
    projectDraft: ReturnType<typeof useShortDramaProject>;
};

export function usePortraitActions({ resolveKey, apiKey, activeTab, isPortraitEnabled, projectDraft }: Options) {
    const [portraitReadiness, setPortraitReadiness] = React.useState<{ key: string; ready: boolean } | null>(null);
    const isVirtualPortraitEnabled = Boolean(
        apiKey && isPortraitEnabled && portraitReadiness?.key === apiKey && portraitReadiness.ready
    );
    const [virtualCharacterGroups, setVirtualCharacterGroups] = React.useState<PortraitGroup[]>([]);
    React.useEffect(() => {
        if (!isPortraitEnabled || !apiKey) return;
        let cancelled = false;
        void fetchPortraitStatus(apiKey)
            .then((status) => {
                if (!cancelled) setPortraitReadiness({ key: apiKey, ready: Boolean(status.aigcOk) });
            })
            .catch((error) => {
                console.warn('Could not check virtual portrait library:', error);
                if (!cancelled) setPortraitReadiness({ key: apiKey, ready: false });
            });
        return () => {
            cancelled = true;
        };
    }, [apiKey, isPortraitEnabled]);
    React.useEffect(() => {
        if (activeTab !== 'video' || !isPortraitEnabled) return;
        let cancelled = false;
        void (async () => {
            const key = await resolveKey();
            if (!key) {
                if (!cancelled) setVirtualCharacterGroups([]);
                return;
            }
            const groups = (await listPortraitGroups(key, 'aigc')).groups;
            if (!cancelled) setVirtualCharacterGroups(groups);
        })().catch((error) => {
            if (error instanceof Error && error.message.toLowerCase().includes('authentication failed')) {
                if (!cancelled) setVirtualCharacterGroups([]);
                return;
            }
            console.warn('Could not load virtual character groups:', error);
            if (!cancelled) setVirtualCharacterGroups([]);
        });
        return () => {
            cancelled = true;
        };
    }, [activeTab, isPortraitEnabled, resolveKey]);

    const handleStartPortraitSession = React.useCallback(
        async (origin: string) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before verifying a person.');
            return createPortraitSession(origin, key);
        },
        [resolveKey]
    );
    const handleLoadPortraitGroups = React.useCallback(
        async (type?: PortraitGroupQueryType) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai to view portrait groups.');
            return (await listPortraitGroups(key, type)).groups;
        },
        [resolveKey]
    );
    const handleLoadPortraitAssets = React.useCallback(
        async (type?: PortraitGroupQueryType) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai to view reviewed assets.');
            return (await listPortraitAssets(key, type)).assets;
        },
        [resolveKey]
    );
    const handleCreatePortraitGroup = React.useCallback(
        async (name: string) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before creating a virtual character.');
            const result = await createPortraitGroup(name, key);
            projectDraft.createCharacterReferencePack(name, [], result.groupId);
            return result;
        },
        [projectDraft, resolveKey]
    );
    const handleDeletePortraitGroup = React.useCallback(
        async (groupId: string) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before deleting a character group.');
            await deletePortraitGroup(groupId, key);
        },
        [resolveKey]
    );
    const handleCreatePortraitAsset = React.useCallback(
        async (input: { groupId: string; url: string; name: string; assetType?: 'Image' | 'Video' | 'Audio' }) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before adding a portrait image.');
            const result = await createPortraitAsset(input, key);
            projectDraft.registerProjectAsset({
                name: input.name,
                kind: 'character',
                sourceType: 'provider',
                status: 'reviewing',
                sourceUrl: input.url,
                providerReferenceUrl: `asset://${result.assetId}`,
                providerAssetId: result.assetId
            });
            return result;
        },
        [projectDraft, resolveKey]
    );
    const handleGetPortraitAsset = React.useCallback(
        async (assetId: string) => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai to check portrait image status.');
            return getPortraitAsset(assetId, key);
        },
        [resolveKey]
    );
    const handleGetPortraitStatus = React.useCallback(async () => {
        const key = await resolveKey();
        if (!key) throw new Error('Sign in at xcity.ai to check the setup.');
        return fetchPortraitStatus(key);
    }, [resolveKey]);
    return {
        isVirtualPortraitEnabled,
        virtualCharacterGroups,
        handleStartPortraitSession,
        handleLoadPortraitGroups,
        handleLoadPortraitAssets,
        handleCreatePortraitGroup,
        handleDeletePortraitGroup,
        handleCreatePortraitAsset,
        handleGetPortraitAsset,
        handleGetPortraitStatus
    };
}
