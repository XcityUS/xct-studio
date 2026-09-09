import { portraitCollections } from '@/features/assets/components/AssetsPanel/utils';
import type { PortraitGroup } from '@/features/assets/portrait/api';
import { describe, expect, it } from 'vitest';

describe('portraitCollections', () => {
    it('keeps review infrastructure groups out of character asset groups', () => {
        const groups: PortraitGroup[] = [
            { id: 'group-character', name: 'xcity:user-1:hero', groupType: 'AIGC' },
            { id: 'group-review', name: 'xcity:user-1:reviewed-materials', groupType: 'AIGC' }
        ];

        expect(portraitCollections([], groups, [], {}).virtualGroups).toEqual([groups[0]]);
    });
});
