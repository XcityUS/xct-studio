export type ReferenceOrigin =
    | 'no-person'
    | 'official-asset'
    | 'byteplus-ai'
    | 'thirdparty-ai'
    | 'real-person'
    | 'public-figure'
    | 'licensed-ip';

export type InlineReviewOrigin = Extract<ReferenceOrigin, 'no-person' | 'thirdparty-ai'>;

export type ReferenceDeclaration = {
    origin: ReferenceOrigin;
    declaredAt: number;
    model?: string;
    assetId?: string;
    groupId?: string;
    authorizationId?: string;
};

/** Display order mirrors the compliance path from immediately usable to blocked. */
export const REFERENCE_ORIGINS: ReferenceOrigin[] = [
    'byteplus-ai',
    'official-asset',
    'no-person',
    'thirdparty-ai',
    'real-person',
    'public-figure',
    'licensed-ip'
];

export const ASSET_LIBRARY_MODEL_BLOCK_REASON =
    'Switch to Seedance 2.0 or 2.5 before using the portrait asset library. Seedance 1.5 Pro cannot attach asset:// references.';

/** The form has to explain why an origin changes the submission path. */
export const REFERENCE_ORIGIN_LABELS: Record<ReferenceOrigin, { label: string; hint: string }> = {
    'official-asset': {
        label: 'Official material',
        hint: 'Use the Asset ID supplied by ModelArk or the approved offline batch.'
    },
    'no-person': {
        label: 'No person in this image',
        hint: 'Landscapes, products, styles — nothing that identifies someone.'
    },
    'byteplus-ai': {
        label: 'AI-generated · Studio model',
        hint: 'Made by Studio image models. Usable directly.'
    },
    'thirdparty-ai': {
        label: 'AI-generated · other model',
        hint: 'External AI renders. Create a virtual asset here before submitting.'
    },
    'real-person': {
        label: 'A real person',
        hint: 'You or someone who consented. Must be verified once in the real-human library.'
    },
    'public-figure': {
        label: 'Public figure',
        hint: 'Requires complete likeness authorization, account approval, and an approved Asset ID.'
    },
    'licensed-ip': {
        label: 'Celebrity or licensed character',
        hint: 'Blocked until an authorization document is approved.'
    }
};

const MEDIA_REFERENCE_PATH_RE = /\/media\/(?:u|k)\/[^/]+\/refs\/([0-9a-f]{32,64})\.[^/?#]+$/i;

function stripQueryAndHash(value: string): string {
    return value.replace(/[?#].*$/, '');
}

/**
 * Declarations follow content identity, not the current serving hostname.
 */
export function refKey(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';

    const assetMatch = /^asset:\/\/(.+)$/i.exec(trimmed);
    if (assetMatch?.[1]?.trim()) {
        return `asset:${assetMatch[1].trim()}`;
    }

    let path = stripQueryAndHash(trimmed);
    try {
        path = new URL(trimmed).pathname;
    } catch {
        // Relative worker paths are useful in tests and share the same key shape.
    }

    const mediaMatch = MEDIA_REFERENCE_PATH_RE.exec(path);
    if (mediaMatch?.[1]) {
        return mediaMatch[1].toLowerCase();
    }

    try {
        const parsed = new URL(trimmed);
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().toLowerCase();
    } catch {
        return stripQueryAndHash(trimmed).toLowerCase();
    }
}

export function normalizeAssetId(value: string): string {
    const assetId = value
        .trim()
        .replace(/^asset:\/\//i, '')
        .trim();
    return assetId && !/\s/.test(assetId) ? assetId : '';
}

export function assetIdFromReferenceUrl(url: string): string | undefined {
    const assetId = normalizeAssetId(url);
    return /^asset:\/\//i.test(url.trim()) && assetId ? assetId : undefined;
}

export function originRequiresAuthorization(origin: ReferenceOrigin): boolean {
    return origin === 'public-figure' || origin === 'licensed-ip';
}

export function originSupportsInlineReview(origin: ReferenceOrigin): origin is InlineReviewOrigin {
    return origin === 'no-person' || origin === 'thirdparty-ai';
}

/**
 * Phase 1 only lets images through when no downstream library work is needed.
 */
export function declarationSatisfied(
    decl: ReferenceDeclaration | undefined,
    approvedAuthorizationIds: ReadonlySet<string> = new Set()
): boolean {
    if (!decl) return false;
    if (decl.origin === 'byteplus-ai') return true;
    if (!decl.assetId) return false;
    if (!originRequiresAuthorization(decl.origin)) return true;
    return Boolean(decl.authorizationId && approvedAuthorizationIds.has(decl.authorizationId));
}

export function declarationBlockReason(
    decl: ReferenceDeclaration | undefined,
    approvedAuthorizationIds: ReadonlySet<string> = new Set()
): string | null {
    if (declarationSatisfied(decl, approvedAuthorizationIds)) return null;
    if (!decl) return 'Choose where this image came from.';

    if (!decl.assetId) {
        if (decl.origin === 'official-asset') return 'Attach the official Asset ID before submitting.';
        if (decl.origin === 'no-person') return 'Review this material and attach its Asset ID before submitting.';
        if (decl.origin === 'thirdparty-ai') {
            return 'Add this AI-generated material to the virtual asset library before submitting.';
        }
        if (decl.origin === 'real-person') {
            return 'Verify this person and attach the approved Asset ID before submitting.';
        }
        if (decl.origin === 'public-figure') {
            return 'Complete likeness authorization and attach the approved Asset ID before submitting.';
        }
        if (decl.origin === 'licensed-ip') {
            return 'Complete IP authorization and attach the approved Asset ID before submitting.';
        }
    }
    if (originRequiresAuthorization(decl.origin)) {
        return decl.authorizationId
            ? 'This authorization is not approved yet. Studio approval only unblocks this reference check; final model moderation may still reject the image.'
            : 'Submit an approved authorization document before using this public figure or licensed IP. Studio approval only unblocks this reference check; final model moderation may still reject the image.';
    }
    return 'Choose where this image came from.';
}

export function originRequiresAssetLibrary(origin: ReferenceOrigin): boolean {
    return origin !== 'byteplus-ai';
}

/** `asset://<id>` — a reference already living in a BytePlus portrait library. */
export function isAssetReferenceUrl(url: string): boolean {
    const value = url.trim();
    return value.startsWith('asset://') && value.length > 'asset://'.length;
}

/**
 * True when this reference can only be sent as an `asset://` id — which
 * Seedance 1.5 Pro cannot take, so the caller has to say "switch model"
 * before "go set this up".
 */
export function referenceRequiresAssetLibrary(url: string, declaration: ReferenceDeclaration | undefined): boolean {
    return isAssetReferenceUrl(url) || (declaration ? originRequiresAssetLibrary(declaration.origin) : false);
}

/** Every model this studio can drive is BytePlus's; anything else is someone's third-party render. */
const BYTEPLUS_MODEL_RE = /^(byteplus\/)?(dreamina-)?(seedance|seedream)/i;

/**
 * Origin of an image the studio itself produced — a Seedream render, a frame
 * captured from a Seedance clip. Asking the user to declare our own output
 * would be busywork, so these paths declare themselves.
 */
export function originForGeneratedImage(model: string | undefined): ReferenceOrigin {
    return BYTEPLUS_MODEL_RE.test((model ?? '').trim()) ? 'byteplus-ai' : 'thirdparty-ai';
}
