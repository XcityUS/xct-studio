import * as React from 'react';

export type AssetDeletionStatus = 'checking' | 'allowed' | 'protected' | 'unavailable';

export async function checkAssetDeletionPermission(check: () => Promise<boolean>): Promise<Exclude<AssetDeletionStatus, 'checking'>> {
    try {
        return (await check()) ? 'protected' : 'allowed';
    } catch {
        return 'unavailable';
    }
}

export function useAssetDeletionProtection(active: boolean, checkDeletionProtection: () => Promise<boolean>): AssetDeletionStatus {
    const [status, setStatus] = React.useState<AssetDeletionStatus>('checking');

    React.useEffect(() => {
        if (!active) return;
        let cancelled = false;
        void checkAssetDeletionPermission(checkDeletionProtection)
            .then((permission) => { if (!cancelled) setStatus(permission); });
        return () => { cancelled = true; };
    }, [active, checkDeletionProtection]);

    return status;
}
