'use client';

import { ProjectConfigDialog } from '../ProjectConfigDialog';
import styles from './index.module.scss';
import { titleConflict } from '@/features/projects/components/ProjectHeader/title';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Dropdown } from '@/components/ui/Dropdown';
import type { ProjectAsset, ShortDramaProject, ShortDramaProjectInput } from '@/shared/contracts/production';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export type ProjectManagementControlsProps = {
    project: ShortDramaProject;
    projects: ShortDramaProject[];
    projectAssets: ProjectAsset[];
    onCreateProject: (input: ShortDramaProjectInput) => void;
    onSelectProject: (projectId: string) => void;
    onUpdateProject: (input: ShortDramaProjectInput) => void;
    onDeleteProject: (projectId: string) => void;
    deletionBlocked?: boolean;
};

export function ProjectManagementControls({
    project,
    projects,
    projectAssets,
    onCreateProject,
    onSelectProject,
    onUpdateProject,
    onDeleteProject,
    deletionBlocked = false
}: ProjectManagementControlsProps) {
    const t = useTranslations();
    const [action, setAction] = React.useState<'create' | 'edit' | 'delete' | null>(null);
    const [targetId, setTargetId] = React.useState(project.id);
    const characterAssetCount = projectAssets.filter((asset) => asset.kind === 'character').length;

    const openAction = (next: 'create' | 'edit' | 'delete') => {
        setTargetId(project.id);
        setAction(next);
    };

    return (
        <div className={styles.panel}>
            <div className={styles.controls}>
                <Dropdown
                    value={project.id}
                    options={projects.map((item) => ({ value: item.id, label: item.title }))}
                    ariaLabel={t('Select project')}
                    triggerClassName={styles.dropdown}
                    onValueChange={onSelectProject}
                />
                <button type='button' className={styles.button} onClick={() => openAction('create')}>
                    {t('New project')}
                </button>
                <button type='button' className={styles.secondaryButton} onClick={() => openAction('edit')}>
                    {t('Project settings')}
                </button>
                <button
                    type='button'
                    className={styles.dangerButton}
                    disabled={projects.length <= 1 || deletionBlocked}
                    onClick={() => openAction('delete')}>
                    {t('Delete project')}
                </button>
            </div>
            <div className={styles.meta}>
                <span>{project.sourceLanguage}</span>
                <span>{project.targetRatio}</span>
                <span>{project.targetResolution}</span>
                <span>{project.generationModel}</span>
                <span>
                    {t('Project assets')}: {projectAssets.length}
                </span>
                <span>
                    {t('Character assets')}: {characterAssetCount}
                </span>
            </div>
            {deletionBlocked && <p className={styles.notice}>{t('Finish active video tasks before deleting a project')}</p>}
            {(action === 'create' || action === 'edit') && (
                <ProjectConfigDialog
                    mode={action}
                    open
                    project={action === 'edit' ? project : undefined}
                    titleConflict={(value) => titleConflict(projects, value, action === 'edit' ? targetId : undefined)}
                    onOpenChange={(open) => {
                        if (!open) setAction(null);
                    }}
                    onSave={(input) => {
                        if (action === 'create') onCreateProject(input);
                        else if (targetId === project.id) onUpdateProject(input);
                        setAction(null);
                    }}
                />
            )}
            <Dialog
                open={action === 'delete'}
                onOpenChange={(open) => {
                    if (!open) setAction(null);
                }}>
                <DialogContent className={styles.dialog}>
                    <DialogHeader>
                        <DialogTitle>{t('Delete project')}</DialogTitle>
                        <DialogDescription>
                            {t('Remove this local project draft<q> Shared media will not be deleted')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className={styles.confirmControls}>
                        <button type='button' className={styles.secondaryButton} onClick={() => setAction(null)}>
                            {t('Cancel')}
                        </button>
                        <button
                            type='button'
                            className={styles.dangerButton}
                            disabled={deletionBlocked || targetId !== project.id}
                            onClick={() => {
                                onDeleteProject(targetId);
                                setAction(null);
                            }}>
                            {t('Confirm deletion')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
