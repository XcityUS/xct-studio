import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/database/pool', () => ({ readyDatabase: vi.fn() }));

import { identitySubjects } from '@/server/persistence/auth';

describe('business identity', () => {
    it('uses the same canonical subject for TokenHub aliases', () => {
        const userId = 'user-123';
        const legacy = identitySubjects('https://tokenhub.xcity.one', userId);
        const current = identitySubjects('https://tokenhub.xcity.ai', userId);

        expect(legacy.canonicalSubject).toBe('xcity:user-123');
        expect(current.canonicalSubject).toBe(legacy.canonicalSubject);
        expect(current.legacySubjects).toEqual(
            expect.arrayContaining([
                'xcity:user-123',
                'https://tokenhub.xcity.ai:user-123',
                'https://tokenhub.xcity.one:user-123'
            ])
        );
    });
});
