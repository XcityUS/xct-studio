export type ReferenceOrigin = 'no-person' | 'byteplus-ai' | 'thirdparty-ai' | 'real-person' | 'licensed-ip';

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
    'no-person',
    'byteplus-ai',
    'thirdparty-ai',
    'real-person',
    'licensed-ip'
];

export const ASSET_LIBRARY_MODEL_BLOCK_REASON =
    'Switch to Seedance 2.0 or 2.5 before using the portrait asset library. Seedance 1.5 Pro cannot attach asset:// references.';

/** The form has to explain why an origin changes the submission path. */
export const REFERENCE_ORIGIN_LABELS: Record<ReferenceOrigin, { label: string; hint: string }> = {
    'no-person': {
        label: 'No person in this image',
        hint: 'Landscapes, products, styles — nothing that identifies someone.'
    },
    'byteplus-ai': {
        label: 'AI-generated · Seedream/BytePlus',
        hint: "Made by BytePlus's own image models. Usable directly."
    },
    'thirdparty-ai': {
        label: 'AI-generated · other model',
        hint: 'Imagen, nano-banana and other non-BytePlus renders. Create a virtual asset here before submitting.'
    },
    'real-person': {
        label: 'A real person',
        hint: 'You or someone who consented. Must be verified once in the real-human library.'
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

/**
 * Phase 1 only lets images through when no downstream library work is needed.
 */
export function declarationSatisfied(
    decl: ReferenceDeclaration | undefined,
    approvedAuthorizationIds: ReadonlySet<string> = new Set()
): boolean {
    if (!decl) return false;
    if (decl.origin === 'no-person' || decl.origin === 'byteplus-ai') return true;
    if (decl.origin === 'thirdparty-ai' || decl.origin === 'real-person') return Boolean(decl.assetId);
    return Boolean(decl.authorizationId && approvedAuthorizationIds.has(decl.authorizationId));
}

export function declarationBlockReason(
    decl: ReferenceDeclaration | undefined,
    approvedAuthorizationIds: ReadonlySet<string> = new Set()
): string | null {
    if (declarationSatisfied(decl, approvedAuthorizationIds)) return null;
    if (!decl) return 'Choose where this image came from.';

    if (decl.origin === 'thirdparty-ai') {
        return 'Add this AI-generated person to the virtual portrait library before submitting.';
    }
    if (decl.origin === 'real-person') {
        return 'Verify this person in the real-human library before submitting.';
    }
    if (decl.origin === 'licensed-ip') {
        return decl.authorizationId
            ? 'This authorization is not approved yet. Studio approval only unblocks this check; BytePlus may still reject the image during moderation.'
            : 'Submit an approved authorization document before using this celebrity or licensed character. Studio approval only unblocks this check; BytePlus may still reject the image during moderation.';
    }
    return 'Choose where this image came from.';
}

export function originRequiresAssetLibrary(origin: ReferenceOrigin): boolean {
    return origin === 'thirdparty-ai' || origin === 'real-person';
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
