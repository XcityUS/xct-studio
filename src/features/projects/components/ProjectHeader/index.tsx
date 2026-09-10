'use client';

import { ProjectConfigDialog } from '../ProjectConfigDialog';
import styles from './index.module.scss';
import { titleConflict } from './title';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Dropdown } from '@/components/ui/Dropdown';
import { useVideoMode } from '@/features/projects/hooks/use-video-mode';
import type { ProjectAsset, ShortDramaProject, ShortDramaProjectInput } from '@/shared/contracts/production';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type ProjectHeaderProps = {
    project: ShortDramaProject;
    projects: ShortDramaProject[];
    projectAssets: ProjectAsset[];
    onCreateProject: (input: ShortDramaProjectInput) => void;
    onSelectProject: (projectId: string) => void;
    onUpdateProject: (input: ShortDramaProjectInput) => void;
    onDeleteProject: (projectId: string) => void;
    onOpenAssets?: () => void;
    deletionBlocked?: boolean;
};

export function ProjectHeader({
    project,
    projects,
    projectAssets,
    onCreateProject,
    onSelectProject,
    onUpdateProject,
    onDeleteProject,
    onOpenAssets,
    deletionBlocked = false
}: ProjectHeaderProps) {
    const t = useTranslations();
    const [mode, setMode] = useVideoMode();
    const [action, setAction] = React.useState<'create' | 'edit' | 'delete' | null>(null);
    const [targetId, setTargetId] = React.useState(project.id);
    const openAction = (next: 'create' | 'edit' | 'delete') => {
        setTargetId(project.id);
        setAction(next);
    };

    return (
        <section className={styles.panel} aria-label={t('Short<dash>drama project')}>
            <Dropdown
                value={mode}
                onValueChange={(value) => setMode(value === 'drama' ? 'drama' : 'normal')}
                ariaLabel={t('Video mode')}
                options={[
                    { value: 'normal', label: t('Normal') },
                    { value: 'drama', label: t('Short Drama') }
                ]}
            />
            {mode === 'drama' && (
                <>
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
                        <span>{t('Local production draft')}</span>
                        <span>
                            {t('Project assets')}: {projectAssets.length}
                        </span>
                        <span>
                            {t('Character assets')}:{' '}
                            {projectAssets.filter((asset) => asset.kind === 'character').length}
                        </span>
                    </div>
                    {deletionBlocked && (
                        <p className={styles.notice}>{t('Finish active video tasks before deleting a project')}</p>
                    )}
                    <div className={styles.guide}>
                        <span>
                            {t(
                                'Review script characters and scenes<comma> then choose their reference assets before generating shots'
                            )}
                        </span>
                        {onOpenAssets && (
                            <button type='button' className={styles.secondaryButton} onClick={onOpenAssets}>
                                {t('Open Assets')}
                            </button>
                        )}
                    </div>
                    {(action === 'create' || action === 'edit') && (
                        <ProjectConfigDialog
                            mode={action}
                            open
                            project={action === 'edit' ? project : undefined}
                            titleConflict={(value) =>
                                titleConflict(projects, value, action === 'edit' ? targetId : undefined)
                            }
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
                            <div className={styles.controls}>
                                <button
                                    type='button'
                                    className={styles.secondaryButton}
                                    onClick={() => setAction(null)}>
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
                </>
            )}
        </section>
    );
}
