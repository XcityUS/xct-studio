import { SEEDANCE_MODELS } from '@/shared/config/seedance';
import { describe, expect, it } from 'vitest';

describe('Seedance model labels', () => {
    it('shows provider names without changing gateway model IDs', () => {
        expect(SEEDANCE_MODELS.map(({ id, label }) => ({ id, label }))).toEqual([
            { id: 'seedance-1-5-pro-251215', label: 'Seedance 1.5 Pro' },
            { id: 'dreamina-seedance-2-0-260128', label: 'Seedance 2.0' },
            { id: 'dreamina-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast' },
            { id: 'dreamina-seedance-2-5-260628', label: 'Seedance 2.5' }
        ]);
    });
});
