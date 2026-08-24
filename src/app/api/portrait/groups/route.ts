import { ArkOpenApiError, arkOpenApi } from '@/lib/server/byteplus-openapi';
import {
    arrayField,
    isOwnedGroupName,
    jsonError,
    ownerGroupName,
    portraitGroupSlug,
    readRecord,
    readJsonRecord,
    requirePortraitRoute,
    responseJson,
    resultRoot,
    stringField
} from '@/lib/server/portrait-routes';

export const dynamic = 'force-dynamic';

type AssetGroupType = 'LivenessFace' | 'AIGC';

const GROUP_PAGE_SIZE = 100;
const MAX_GROUP_PAGES = 10;

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

function createGroupId(payload: unknown): string {
    const root = resultRoot(payload);
    return stringField(root, 'Id', 'ID', 'GroupId', 'groupId', 'AssetGroupId');
}

function groupTypesForQuery(value: string | null): AssetGroupType[] | null {
    const type = value?.trim().toLowerCase() || 'liveness';
    if (type === 'liveness') return ['LivenessFace'];
    if (type === 'aigc') return ['AIGC'];
    if (type === 'all') return ['LivenessFace', 'AIGC'];
    return null;
}

async function listGroupsByType(groupType: AssetGroupType): Promise<Record<string, unknown>[]> {
    const groups: Record<string, unknown>[] = [];
    for (let pageNumber = 1; pageNumber <= MAX_GROUP_PAGES; pageNumber++) {
        const payload = await arkOpenApi('ListAssetGroups', {
            Filter: { GroupType: groupType },
            PageNumber: pageNumber,
            PageSize: GROUP_PAGE_SIZE
        });
        const pageGroups = groupRecords(payload);
        groups.push(...pageGroups);
        if (pageGroups.length < GROUP_PAGE_SIZE) break;
    }
    return groups;
}

function errorText(err: unknown): string {
    if (err instanceof ArkOpenApiError) return JSON.stringify(err.payload);
    return err instanceof Error ? err.message : '';
}

function isAuthorizationAgreementError(err: unknown): boolean {
    return /authorization letter|agreement|授权/i.test(errorText(err));
}

export async function GET(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const requestedTypes = groupTypesForQuery(new URL(request.url).searchParams.get('type'));
    if (!requestedTypes) {
        return jsonError('type must be liveness, aigc, or all', 400);
    }

    try {
        const groups = (
            await Promise.all(
                requestedTypes.map(async (requestedType) =>
                    (await listGroupsByType(requestedType)).map((group) => ({
                        id: stringField(group, 'Id', 'ID', 'GroupId', 'groupId', 'AssetGroupId'),
                        name: stringField(group, 'Name', 'name'),
                        groupType: stringField(group, 'GroupType', 'groupType') === 'AIGC' ? 'AIGC' : requestedType
                    }))
                )
            )
        )
            .flat()
            .filter((group) => group.id && isOwnedGroupName(group.name, gate.auth.userId));
        return responseJson({ groups });
    } catch (err) {
        return jsonError(err instanceof Error ? err.message : 'portrait groups failed', 502);
    }
}

export async function POST(request: Request) {
    const gate = await requirePortraitRoute(request);
    if ('response' in gate) return gate.response;

    const body = await readJsonRecord(request);
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (!name) {
        return jsonError('missing name', 400);
    }

    const slug = portraitGroupSlug(name);
    const groupName = ownerGroupName(gate.auth.userId, slug);

    try {
        const existing = (await listGroupsByType('AIGC'))
            .map((group) => ({
                id: stringField(group, 'Id', 'ID', 'GroupId', 'groupId', 'AssetGroupId'),
                name: stringField(group, 'Name', 'name')
            }))
            .find((group) => group.id && group.name === groupName);
        if (existing) {
            return responseJson({ groupId: existing.id, slug, created: false });
        }

        const payload = await arkOpenApi('CreateAssetGroup', {
            Name: groupName,
            Description: name,
            GroupType: 'AIGC'
        });
        const groupId = createGroupId(payload);
        if (!groupId) {
            return jsonError(`portrait group returned an unexpected payload: ${JSON.stringify(payload)}`, 502);
        }
        return responseJson({ groupId, slug, created: true });
    } catch (err) {
        if (isAuthorizationAgreementError(err)) {
            return jsonError(
                'The virtual portrait library is waiting on BytePlus authorization. Ask the Xcity admin to complete the AIGC asset authorization agreement, then retry.',
                409
            );
        }
        return jsonError(err instanceof Error ? err.message : 'portrait group creation failed', 502);
    }
}
