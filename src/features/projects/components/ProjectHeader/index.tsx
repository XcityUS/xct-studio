'use client';

import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import type { ProjectAsset, ShortDramaProject } from '@/shared/contracts/production';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type ProjectHeaderProps = {
    project: ShortDramaProject;
    projects: ShortDramaProject[];
    projectAssets: ProjectAsset[];
    onCreateProject: (title: string) => void;
    onSelectProject: (projectId: string) => void;
    onRenameProject: (title: string) => void;
    onDeleteProject: (projectId: string) => void;
    onOpenAssets?: () => void;
};

export function ProjectHeader({
    project,
    projects,
    projectAssets,
    onCreateProject,
    onSelectProject,
    onRenameProject,
    onDeleteProject,
    onOpenAssets
}: ProjectHeaderProps) {
    const t = useTranslations();
    const activeAssetCount = projectAssets.filter((asset) => asset.status === 'active').length;
    const characterAssetCount = projectAssets.filter((asset) => asset.kind === 'character').length;
    const titleInputRef = React.useRef<HTMLInputElement>(null);
    const projectOptions = projects
        .filter((item, index, list) => {
            const key = item.title.trim().toLocaleLowerCase();
            const preferred =
                list.find((candidate) => candidate.id === project.id && candidate.title.trim().toLocaleLowerCase() === key) ??
                list.find((candidate) => candidate.title.trim().toLocaleLowerCase() === key);
            return preferred?.id === item.id;
        })
        .map((item) => ({ value: item.id, label: item.title }));
    const saveTitle = (value: string) => {
        const title = value.trim();
        const existingProject = projects.find(
            (item) => item.id !== project.id && item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase()
        );
        if (existingProject) {
            onSelectProject(existingProject.id);
            return;
        }
        if (title && title !== project.title) {
            onRenameProject(title);
        }
    };

    return (
        <section className={styles.panel} aria-label={t('Short<dash>drama project')}>
            <div className={styles.main}>
                <div className={styles.content}>
                    <div className={styles.titleBlock}>
                        <div className={styles.label}>{t('Current short<dash>drama project')}</div>
                        <h2 className={styles.title}>{project.title}</h2>
                        <div className={styles.meta}>
                            <span>{project.sourceLanguage}</span>
                            <span>{project.targetRatio}</span>
                            <span>{t('Local production draft')}</span>
                        </div>
                    </div>
                    <div className={styles.stats}>
                        <span className={styles.stat}>
                            <strong>{projectAssets.length}</strong>
                            {t('Project assets')}
                        </span>
                        <span className={styles.stat}>
                            <strong>{activeAssetCount}</strong>
                            {t('Provider<dash>ready')}
                        </span>
                        <span className={styles.stat}>
                            <strong>{characterAssetCount}</strong>
                            {t('Character assets')}
                        </span>
                    </div>
                </div>
                <div className={styles.controls}>
                    <Dropdown
                        value={project.id}
                        options={projectOptions}
                        ariaLabel={t('Select project')}
                        triggerClassName={styles.dropdown}
                        onValueChange={onSelectProject}
                    />
                    <input
                        key={project.id}
                        ref={titleInputRef}
                        className={styles.input}
                        defaultValue={project.title}
                        aria-label={t('Project title')}
                        onBlur={(event) => saveTitle(event.currentTarget.value)}
                    />
                    <button
                        type='button'
                        className={styles.button}
                        onClick={() => onCreateProject(titleInputRef.current?.value || t('Untitled short<dash>drama project'))}>
                        {t('New project')}
                    </button>
                    <button
                        type='button'
                        className={styles.dangerButton}
                        disabled={projects.length <= 1}
                        onClick={() => onDeleteProject(project.id)}>
                        {t('Delete project')}
                    </button>
                </div>
            </div>
            <div className={styles.guide}>
                <span>{t('Import a script first<comma> let AI extract characters and shots<comma> then bind assets for character consistency')}</span>
                {onOpenAssets ? (
                    <button type='button' className={styles.secondaryButton} onClick={onOpenAssets}>
                        {t('Open Assets')}
                    </button>
                ) : null}
            </div>
        </section>
    );
}
