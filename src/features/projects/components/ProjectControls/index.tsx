'use client';

import { ProjectHeader } from '../ProjectHeader';
import type { useShortDramaProject } from '@/features/projects/hooks/use-short-drama-project';

export function ProjectControls({
    draft,
    busy,
    onOpenAssets
}: {
    draft: ReturnType<typeof useShortDramaProject>;
    busy: boolean;
    onOpenAssets?: () => void;
}) {
    return (
        <ProjectHeader
            project={draft.activeProject}
            projects={draft.projects}
            projectAssets={draft.projectAssets}
            onCreateProject={draft.addProject}
            onSelectProject={draft.setActiveProjectId}
            onUpdateProject={draft.updateActiveProject}
            onDeleteProject={draft.deleteProject}
            deletionBlocked={busy}
            onOpenAssets={onOpenAssets}
        />
    );
}
