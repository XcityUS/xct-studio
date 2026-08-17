import { arkOpenApi } from '@/lib/server/byteplus-openapi';
import {
    arrayField,
    jsonError,
    ownerTag,
    readRecord,
    requirePortraitRoute,
    responseJson,
    resultRoot,
    stringField
} from '@/lib/server/portrait-routes';

export const dynamic = 'force-dynamic';

function groupRecords(payload: unknown): Record<string, unknown>[] {
    const root = resultRoot(payload);
    const data = readRecord(root.Data);
    let source = arrayField(root, 'Groups', 'AssetGroups', 'AssetGroupList', 'GroupList', 'Items', 'List');
    if (!source.length && data) {
        source = arrayField(data, 'Groups', 'AssetGroups', 'AssetGroupList', 'GroupList', 'Items', 'List');
    }
    return source.flatMap((item) => {
        const record = readRecord(item);
        return record ? [record] : [];
    });
}

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    try {
        const payload = await arkOpenApi('ListAssetGroups', {
            PageNumber: 1,
            PageSize: 100
        });
        const tag = ownerTag(gate.auth.userId);
        const groups = groupRecords(payload)
            .map((group) => ({
                id: stringField(group, 'Id', 'ID', 'GroupId', 'groupId', 'AssetGroupId'),
                name: stringField(group, 'Name', 'name')
            }))
            .filter((group) => group.id && group.name === tag);
        return responseJson({ groups });
    } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'portrait groups failed', 502);
    }
}
