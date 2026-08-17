export type PortraitSession = {
    h5Link: string;
    bytedToken: string;
};

export type PortraitGroup = {
    id: string;
    name: string;
};

export type PortraitAssetStatus = 'Processing' | 'Active' | 'Failed' | string;

export type PortraitAsset = {
    status: PortraitAssetStatus;
    previewUrl: string;
};

async function portraitRequest<T>(
    path: string,
    apiKey: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}
): Promise<T> {
    const res = await fetch(path, {
        ...init,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers
        },
        cache: 'no-store'
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
        throw new Error(body.error || `Portrait request failed (${res.status}).`);
    }
    return body as T;
}

export function createPortraitSession(origin: string, apiKey: string): Promise<PortraitSession> {
    return portraitRequest<PortraitSession>('/api/portrait/session', apiKey, {
        method: 'POST',
        body: JSON.stringify({ origin })
    });
}

export function resolvePortraitResult(bytedToken: string, apiKey: string): Promise<{ groupId: string }> {
    return portraitRequest<{ groupId: string }>('/api/portrait/result', apiKey, {
        method: 'POST',
        body: JSON.stringify({ bytedToken })
    });
}

export function listPortraitGroups(apiKey: string): Promise<{ groups: PortraitGroup[] }> {
    return portraitRequest<{ groups: PortraitGroup[] }>('/api/portrait/groups', apiKey);
}

export function createPortraitAsset(
    input: { groupId: string; url: string; name: string },
    apiKey: string
): Promise<{ assetId: string }> {
    return portraitRequest<{ assetId: string }>('/api/portrait/asset', apiKey, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}

export function getPortraitAsset(assetId: string, apiKey: string): Promise<PortraitAsset> {
    return portraitRequest<PortraitAsset>(`/api/portrait/asset?id=${encodeURIComponent(assetId)}`, apiKey);
}
