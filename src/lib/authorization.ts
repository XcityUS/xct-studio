import { mediaWorkerUrl } from './media-archive';

export type AuthorizationStatus = 'pending' | 'approved' | 'rejected';
export type AuthorizationReviewAction = 'approve' | 'reject';

export interface AuthorizationItem {
    id: string;
    subject_name: string;
    reference_key: string;
    note: string;
    status: AuthorizationStatus;
    created_at: string;
    reviewed_at: string;
    reviewed_by: string;
    review_note: string;
    doc_bytes: number;
    doc_content_type: string;
    has_doc: boolean;
}

export interface AuthorizationQueueItem extends AuthorizationItem {
    owner: string;
}

export interface CreatedAuthorization {
    id: string;
    status: AuthorizationStatus;
}

const AUTHORIZATION_DOC_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const MAX_AUTHORIZATION_DOC_BYTES = 5 * 1024 * 1024;

function isAuthorizationStatus(value: unknown): value is AuthorizationStatus {
    return value === 'pending' || value === 'approved' || value === 'rejected';
}

async function loadConfiguredWorkerUrl(message: string): Promise<string> {
    const workerUrl = await mediaWorkerUrl();
    if (!workerUrl) {
        throw new Error(message);
    }
    return workerUrl;
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
    const detail = await res
        .json()
        .then((d: { error?: string }) => d.error)
        .catch(() => undefined);
    return detail || fallback;
}

export async function createAuthorization(
    input: { subjectName: string; referenceKey: string; note: string },
    apiKey: string
): Promise<CreatedAuthorization> {
    const workerUrl = await loadConfiguredWorkerUrl('Authorization submission is not configured on this deployment.');
    const res = await fetch(`${workerUrl}/authz`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            subject_name: input.subjectName,
            reference_key: input.referenceKey,
            note: input.note
        })
    });
    if (!res.ok) {
        throw new Error(await errorDetail(res, `Authorization submission failed (${res.status}).`));
    }

    const data = (await res.json()) as { id?: string; status?: unknown };
    if (!data.id || !isAuthorizationStatus(data.status)) {
        throw new Error('Authorization submission returned no id.');
    }
    return { id: data.id, status: data.status };
}

export async function uploadAuthorizationDoc(id: string, file: File, apiKey: string): Promise<AuthorizationStatus> {
    const workerUrl = await loadConfiguredWorkerUrl(
        'Authorization document upload is not configured on this deployment.'
    );
    if (!AUTHORIZATION_DOC_TYPES.has(file.type)) {
        throw new Error('Unsupported document type. Use PDF, PNG, JPEG, or WebP.');
    }
    if (file.size > MAX_AUTHORIZATION_DOC_BYTES) {
        throw new Error('Authorization document is too large (max 5 MB).');
    }

    const res = await fetch(`${workerUrl}/authz/${encodeURIComponent(id)}/doc`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': file.type
        },
        body: file
    });
    if (!res.ok) {
        throw new Error(await errorDetail(res, `Authorization document upload failed (${res.status}).`));
    }

    const data = (await res.json()) as { status?: unknown };
    if (!isAuthorizationStatus(data.status)) {
        throw new Error('Authorization document upload returned no status.');
    }
    return data.status;
}

export async function listAuthorizations(apiKey: string): Promise<AuthorizationItem[]> {
    const workerUrl = await mediaWorkerUrl();
    if (!workerUrl) return [];

    const res = await fetch(`${workerUrl}/authz/list`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(`Could not load authorizations (${res.status}).`);
    }
    const data = (await res.json()) as { items?: AuthorizationItem[] };
    return data.items ?? [];
}

export async function fetchAuthorizationQueue(apiKey: string): Promise<AuthorizationQueueItem[] | null> {
    const workerUrl = await mediaWorkerUrl();
    if (!workerUrl) return null;

    const res = await fetch(`${workerUrl}/authz/queue`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
    });
    if (res.status === 403) return null;
    if (!res.ok) {
        throw new Error(`Could not load authorization review queue (${res.status}).`);
    }
    const data = (await res.json()) as { items?: AuthorizationQueueItem[] };
    return data.items ?? [];
}

export async function reviewAuthorization(
    id: string,
    action: AuthorizationReviewAction,
    note: string,
    apiKey: string
): Promise<AuthorizationStatus> {
    const workerUrl = await loadConfiguredWorkerUrl('Authorization review is not configured on this deployment.');
    const res = await fetch(`${workerUrl}/authz/review`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, action, note })
    });
    if (!res.ok) {
        throw new Error(await errorDetail(res, `Authorization review failed (${res.status}).`));
    }

    const data = (await res.json()) as { status?: unknown };
    if (!isAuthorizationStatus(data.status)) {
        throw new Error('Authorization review returned no status.');
    }
    return data.status;
}

export async function authorizationDocUrl(id: string): Promise<string> {
    const workerUrl = await loadConfiguredWorkerUrl('Authorization documents are not configured on this deployment.');
    return `${workerUrl}/authz/${encodeURIComponent(id)}/doc`;
}

export async function fetchAuthorizationDoc(id: string, apiKey: string): Promise<Blob> {
    const res = await fetch(await authorizationDocUrl(id), {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(await errorDetail(res, `Could not load authorization document (${res.status}).`));
    }
    return res.blob();
}
