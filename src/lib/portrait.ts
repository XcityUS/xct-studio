export type PortraitSession = {
    h5Link: string;
    bytedToken: string;
};

export type PortraitGroup = {
    id: string;
    name: string;
    groupType: PortraitGroupType;
};

export type PortraitGroupType = 'LivenessFace' | 'AIGC';
export type PortraitGroupQueryType = 'liveness' | 'aigc' | 'all';
export type PortraitAssetType = 'Image' | 'Video' | 'Audio';
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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

export function listPortraitGroups(
    apiKey: string,
    type: PortraitGroupQueryType = 'liveness'
): Promise<{ groups: PortraitGroup[] }> {
    return portraitRequest<{ groups: PortraitGroup[] }>(
        `/api/portrait/groups?type=${encodeURIComponent(type)}`,
        apiKey
    );
}

export function createPortraitGroup(
    name: string,
    apiKey: string
): Promise<{ groupId: string; slug: string; created: boolean }> {
    return portraitRequest<{ groupId: string; slug: string; created: boolean }>('/api/portrait/groups', apiKey, {
        method: 'POST',
        body: JSON.stringify({ name })
    });
}

export function createPortraitAsset(
    input: { groupId: string; url: string; name: string; assetType?: PortraitAssetType },
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

export async function waitForPortraitAsset(
    assetId: string,
    loadAsset: (assetId: string) => Promise<PortraitAsset>
): Promise<void> {
    const startedAt = Date.now();
    let lastStatus = '';
    while (Date.now() - startedAt <= 120_000) {
        const asset = await loadAsset(assetId);
        lastStatus = asset.status;
        if (asset.status === 'Active') return;
        if (asset.status === 'Failed') {
            throw new Error(
                'BytePlus rejected this image. Common causes: more than one face in a real-person photo, the face not matching the liveness capture, or the image being outside BytePlus size or ratio limits.'
            );
        }
        await sleep(3000);
    }
    throw new Error(
        lastStatus
            ? `Portrait image is still ${lastStatus.toLowerCase()}. Try again in a moment.`
            : 'Portrait image processing timed out.'
    );
}

export type PortraitStatus = {
    configured: boolean;
    ok: boolean;
    livenessOk: boolean;
    aigcOk: boolean;
    projectName: string;
    error?: string;
};

/** Operator-facing self-test: are the portrait libraries actually usable here? */
export async function fetchPortraitStatus(apiKey: string): Promise<PortraitStatus> {
    const res = await fetch('/api/portrait/status', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(`Portrait status check failed (${res.status}).`);
    }
    return (await res.json()) as PortraitStatus;
}
