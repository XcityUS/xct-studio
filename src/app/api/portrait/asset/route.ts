import { arkOpenApi } from '@/lib/server/byteplus-openapi';
import {
    isOwnedGroupName,
    jsonError,
    readJsonRecord,
    readRecord,
    requirePortraitRoute,
    responseJson,
    resultRoot,
    stringField
} from '@/lib/server/portrait-routes';

export const dynamic = 'force-dynamic';

type PortraitAssetType = 'Image' | 'Video' | 'Audio';

function assetRoot(payload: unknown): Record<string, unknown> {
    const root = resultRoot(payload);
    return readRecord(root.Asset) ?? readRecord(root.AssetInfo) ?? root;
}

function createAssetId(payload: unknown): string {
    const root = assetRoot(payload);
    return stringField(root, 'Id', 'ID', 'AssetId', 'assetId');
}

function readAssetType(value: unknown): PortraitAssetType | null {
    if (typeof value !== 'string' || !value.trim()) return 'Image';
    const assetType = value.trim();
    if (assetType === 'Image' || assetType === 'Video' || assetType === 'Audio') return assetType;
    return null;
}

async function ownedGroupName(groupId: string): Promise<string> {
    const payload = await arkOpenApi('GetAssetGroup', { Id: groupId });
    const root = resultRoot(payload);
    const group = readRecord(root.Group) ?? readRecord(root.AssetGroup) ?? root;
    return stringField(group, 'Name', 'name');
}

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await readJsonRecord(request);
    const groupId = typeof body?.groupId === 'string' ? body.groupId.trim() : '';
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const assetType = readAssetType(body?.assetType);
    if (!groupId || !url || !name) {
        return jsonError('missing groupId, url, or name', 400);
    }
    if (!assetType) {
        return jsonError('assetType must be Image, Video, or Audio', 400);
    }

    try {
        if (!isOwnedGroupName(await ownedGroupName(groupId), gate.auth.userId)) {
            return jsonError('portrait group is not owned by this user', 403);
        }

        // BytePlus ingests the supplied media.xcity.ai URL directly. If that
        // fetch fails, the OpenAPI error JSON will indicate whether to add a
        // serve-through-Railway route or upload through TOS instead.
        const payload = await arkOpenApi('CreateAsset', {
            GroupId: groupId,
            // Spelled URL, not Url (API ref 2318271) — Url is dropped and the
            // call fails as MissingParameter.URL.
            URL: url,
            Name: name,
            AssetType: assetType
        });
        const assetId = createAssetId(payload);
        if (!assetId) {
            return jsonError(`portrait asset returned an unexpected payload: ${JSON.stringify(payload)}`, 502);
        }
        return responseJson({ assetId });
    } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'portrait asset creation failed', 502);
    }
}

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const id = new URL(request.url).searchParams.get('id')?.trim() ?? '';
    if (!id) {
        return jsonError('missing id', 400);
    }

    try {
        const payload = await arkOpenApi('GetAsset', { Id: id });
        const root = assetRoot(payload);
        return responseJson({
            status: stringField(root, 'Status', 'status'),
            previewUrl: stringField(root, 'URL', 'Url', 'url', 'PreviewUrl', 'previewUrl')
        });
    } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'portrait asset status failed', 502);
    }
}
