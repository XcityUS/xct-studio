const migrationKey = (owner: string) => `xctStudioLocalMigrationComplete:v1:${owner}`;

export function localMigrationComplete(owner: string): boolean {
    try {
        return localStorage.getItem(migrationKey(owner)) === '1';
    } catch {
        return false;
    }
}

export function markLocalMigrationComplete(owner: string): void {
    try {
        localStorage.setItem(migrationKey(owner), '1');
    } catch {
        // A missing checkpoint only repeats validation; original data stays intact.
    }
}
