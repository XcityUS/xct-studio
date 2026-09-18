export async function checkAssetDeletionProtection(resolveKey: () => Promise<string | null>): Promise<boolean> {
    const key = await resolveKey();
    if (!key) throw new Error('Sign in at xcity.ai first.');
    const response = await fetch('/api/assets/protection', {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store'
    });
    if (!response.ok) throw new Error('Could not verify asset deletion permission.');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('deletionProtected' in result) ||
        typeof result.deletionProtected !== 'boolean') throw new Error('Invalid asset protection response.');
    return result.deletionProtected;
}
