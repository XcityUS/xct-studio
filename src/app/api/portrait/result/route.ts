import { arkOpenApi } from '@/lib/server/byteplus-openapi';
import {
    jsonError,
    ownerTag,
    readJsonRecord,
    requirePortraitRoute,
    responseJson,
    resultRoot,
    stringField
} from '@/lib/server/portrait-routes';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await readJsonRecord(request);
    const bytedToken = typeof body?.bytedToken === 'string' ? body.bytedToken.trim() : '';
    if (!bytedToken) {
        return jsonError('missing bytedToken', 400);
    }

    try {
        const payload = await arkOpenApi('GetVisualValidateResult', { BytedToken: bytedToken });
        const root = resultRoot(payload);
        const groupId = stringField(root, 'GroupId', 'groupId', 'Id', 'id');
        if (!groupId) {
            return jsonError(`portrait verification returned an unexpected payload: ${JSON.stringify(payload)}`, 502);
        }

        try {
            await arkOpenApi('UpdateAssetGroup', {
                Id: groupId,
                Name: ownerTag(gate.auth.userId)
            });
        } catch (err) {
            console.warn('[portrait] failed to tag asset group:', err);
        }

        return responseJson({ groupId });
    } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'portrait verification result failed', 502);
    }
}
