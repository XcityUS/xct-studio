import { CharacterGroupBrowser } from '@/features/assets/components/AssetsPanel/CharacterGroupBrowser';
import { VerifiedPersonCard } from '@/features/assets/components/AssetsPanel/VerifiedPersonCard';
import { existingVerifiedPhoto, verifiedPhotosFor } from '@/features/assets/components/AssetsPanel/utils';
import { groupVerifiedPhoto, groupedVerifiedPhotos } from '@/features/assets/portrait/group-verified-photo';
import { imageFingerprint, parseVerifiedPeople, uniqueVerifiedGroups } from '@/features/assets/portrait/people';
import en from '@/i18n/messages/en.json';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('verified people', () => {
    it('shows a provider group only once while retaining separate people with different IDs', () => {
        expect(
            uniqueVerifiedGroups([
                { id: 'one', name: 'xcity:same-owner' },
                { id: 'one', name: 'xcity:same-owner' },
                { id: 'two', name: 'xcity:same-owner' }
            ])
        ).toHaveLength(2);
    });

    it('restores person labels and covers from persisted metadata', () => {
        expect(
            parseVerifiedPeople(JSON.stringify({ group: { name: ' Alex ', coverUrl: 'https://example.com/a.png' } }))
        ).toEqual({
            group: { name: 'Alex', coverUrl: 'https://example.com/a.png' }
        });
    });

    it('restores reviewed photo group membership without changing its provider identity', () => {
        expect(
            parseVerifiedPeople(JSON.stringify({ person: { name: 'Alex', photoGroups: { photo: 'character-group' } } }))
        ).toEqual({ person: { name: 'Alex', photoGroups: { photo: 'character-group' } } });
    });

    it('places an approved real-person photo into an existing group without creating a provider asset', async () => {
        const photo = {
            assetId: 'verified-photo', groupId: 'person', groupType: 'LivenessFace' as const,
            name: 'Front', thumbUrl: 'https://example.com/photo.png', status: 'Active' as const, updatedAt: 1
        };
        let savedGroups: Record<string, string> | undefined;
        let projectAssetId = '';
        const result = await groupVerifiedPhoto({
            photo, groupId: 'test2', newGroupName: '',
            groups: [{ id: 'test2', name: 'test2', groupType: 'AIGC' }],
            profile: { name: 'Alex' },
            createGroup: async () => { throw new Error('Existing group must not be recreated'); },
            saveProfile: (_id, patch) => { savedGroups = patch.photoGroups; },
            addToProject: (asset) => { projectAssetId = asset.assetId; }
        });
        expect(result.group.id).toBe('test2');
        expect(savedGroups).toEqual({ 'verified-photo': 'test2' });
        expect(projectAssetId).toBe('verified-photo');
        expect(groupedVerifiedPhotos([photo], { person: { name: 'Alex', photoGroups: savedGroups } })).toEqual([
            { assetId: 'verified-photo', groupId: 'test2', name: 'Front', previewUrl: photo.thumbUrl }
        ]);
    });

    it('merges local and provider photos by asset ID', () => {
        const local = {
            assetId: 'photo',
            groupId: 'person',
            groupType: 'LivenessFace' as const,
            name: 'Portrait',
            thumbUrl: 'https://example.com/photo.png',
            status: 'Active' as const,
            updatedAt: 1
        };
        const provider = {
            assetId: 'photo',
            groupId: 'person',
            groupType: 'LivenessFace' as const,
            name: 'Portrait',
            previewUrl: local.thumbUrl,
            status: 'Active',
            assetType: 'Image' as const,
            failureReason: '',
            createdAt: '',
            updatedAt: ''
        };
        expect(verifiedPhotosFor([local], [provider])).toEqual([local]);
        expect(existingVerifiedPhoto([local], 'person', local.thumbUrl)).toEqual(local);
        expect(existingVerifiedPhoto([local], 'other', local.thumbUrl)).toBeUndefined();
        expect(existingVerifiedPhoto([{ ...local, status: 'Failed' }], 'person', local.thumbUrl)).toBeUndefined();
    });

    it('recognizes the same uploaded bytes before a second provider submission', async () => {
        const first = new File(['same image'], 'front.png', { type: 'image/png' });
        const second = new File(['same image'], 'renamed.png', { type: 'image/png' });
        expect(await imageFingerprint(first)).toBe(await imageFingerprint(second));
    });

    it('shows person identity, cover and active-photo actions without exposing the owner tag', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='en' messages={en} timeZone='UTC'>
                <VerifiedPersonCard
                    group={{ id: 'person', name: 'xcity:owner-tag', groupType: 'LivenessFace' }}
                    profile={{ name: 'Alex', coverUrl: 'https://example.com/cover.png' }}
                    photos={[
                        {
                            assetId: 'photo',
                            groupId: 'person',
                            groupType: 'LivenessFace',
                            name: 'Front',
                            thumbUrl: 'https://example.com/photo.png',
                            status: 'Active',
                            updatedAt: 1
                        }
                    ]}
                    sourceAssets={[]}
                    characterGroups={[]}
                    draft={{ assetKey: '', name: '' }}
                    busy={false}
                    deleting={false}
                    newlyVerified={false}
                    canUpload
                    onProfileChange={() => {}}
                    onCoverUpload={async () => {}}
                    onDraftChange={() => {}}
                    onAddPhoto={() => {}}
                    onUploadPhoto={async () => {}}
                    onDelete={() => {}}
                    onSaveToGroup={async () => {}}
                    onOpenVideo={() => {}}
                />
            </NextIntlClientProvider>
        );
        expect(html).toContain('Alex');
        expect(html).toContain('cover.png');
        expect(html).toContain('Copy Asset ID');
        expect(html).toContain('Save to character group');
        expect(html).toContain('Delete verified person');
        expect(html).not.toContain('xcity:owner-tag');
    });

    it('counts a grouped verified photo and uses it as the group cover', () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale='en' messages={en} timeZone='UTC'>
                <CharacterGroupBrowser
                    groups={[{ id: 'group', name: 'test2', groupType: 'AIGC' }]}
                    assets={[]}
                    verifiedPhotos={[
                        {
                            assetId: 'photo',
                            groupId: 'group',
                            name: 'Front',
                            previewUrl: 'https://example.com/photo.png'
                        }
                    ]}
                    sourceAssets={[]}
                    drafts={{}}
                    addingGroupId={null}
                    deletingGroupId={null}
                    assetInventoryReady
                    groupLabel={(group) => group.name}
                    sourceLabel={(asset) => asset.name || 'Image'}
                    onAdd={async () => {}}
                    onDelete={() => {}}
                    onDraftChange={() => {}}
                />
            </NextIntlClientProvider>
        );
        expect(html).toContain('photo.png');
        expect(html).toContain('Assets 1</span>');
    });
});
