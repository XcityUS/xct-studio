export function normalizedTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function titleConflict(projects: { id: string; title: string }[], title: string, editingId?: string): boolean {
    return projects.some(
        (project) => project.id !== editingId && normalizedTitle(project.title) === normalizedTitle(title)
    );
}
