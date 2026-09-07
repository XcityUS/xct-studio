import type { AuthorizationTarget } from './components/StudioWorkspace/types';
import { originRequiresAuthorization, refKey, type ReferenceDeclaration } from '@/features/assets/reference/origin';

export function buildAuthorizationTargets(
    referenceUrls: string[],
    lastFrameUrl: string,
    declarations: Record<string, ReferenceDeclaration>
): AuthorizationTarget[] {
    const candidates = referenceUrls.map((url, index) => ({ url, label: `Image ${index + 1}` }));
    if (lastFrameUrl.trim()) candidates.push({ url: lastFrameUrl, label: 'Last frame' });

    const seen = new Set<string>();
    return candidates.flatMap((item) => {
        const key = refKey(item.url);
        if (!key || seen.has(key)) return [];
        const declaration = declarations[key];
        if (!declaration || !originRequiresAuthorization(declaration.origin)) return [];
        seen.add(key);
        return [
            {
                key,
                label: item.label,
                url: item.url,
                kind: 'image' as const,
                ...(declaration.authorizationId ? { authorizationId: declaration.authorizationId } : {})
            }
        ];
    });
}
