'use client';

import styles from './index.module.scss';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Dropdown } from '@/components/ui/Dropdown';
import { defaultProjectInput } from '@/features/projects/storage';
import { RATIOS, RESOLUTIONS, SEEDANCE_MODELS } from '@/shared/config/seedance';
import type { ShortDramaProject, ShortDramaProjectInput } from '@/shared/contracts/production';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    mode: 'create' | 'edit';
    open: boolean;
    project?: ShortDramaProject;
    titleConflict: (title: string) => boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (input: ShortDramaProjectInput) => void;
};

function projectInput(project?: ShortDramaProject): ShortDramaProjectInput {
    if (!project) return defaultProjectInput();
    return {
        title: project.title,
        genre: project.genre,
        sourceLanguage: project.sourceLanguage,
        voiceLanguage: project.voiceLanguage,
        subtitleMode: project.subtitleMode,
        targetRatio: project.targetRatio,
        targetResolution: project.targetResolution,
        generationModel: project.generationModel,
        watermark: project.watermark,
        watermarkText: project.watermarkText,
        basePrompt: project.basePrompt,
        styleNote: project.styleNote
    };
}

export function ProjectConfigDialog({ mode, open, project, titleConflict, onOpenChange, onSave }: Props) {
    const t = useTranslations();
    const [draft, setDraft] = React.useState<ShortDramaProjectInput>(() => projectInput(project));

    const update = <Key extends keyof ShortDramaProjectInput>(key: Key, value: ShortDramaProjectInput[Key]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };
    const conflict = titleConflict(draft.title);
    const valid = Boolean(draft.title.trim() && draft.sourceLanguage && draft.generationModel);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={styles.dialog}>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? t('New project') : t('Project settings')}</DialogTitle>
                    <DialogDescription>
                        {t('These settings apply to every new shot in this short<dash>drama project')}
                    </DialogDescription>
                </DialogHeader>
                <form
                    className={styles.form}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!valid || conflict) return;
                        onSave({ ...draft, title: draft.title.trim() });
                        onOpenChange(false);
                    }}>
                    <div className={styles.grid}>
                        <label className={styles.field}>
                            {t('Project title')}
                            <input
                                value={draft.title}
                                maxLength={120}
                                autoFocus
                                aria-invalid={conflict}
                                onChange={(event) => update('title', event.target.value)}
                            />
                            {conflict && (
                                <span className={styles.error}>{t('A project with this name already exists')}</span>
                            )}
                        </label>
                        <label className={styles.field}>
                            {t('Short drama genre')}
                            <input value={draft.genre} onChange={(event) => update('genre', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            {t('Source language')}
                            <Dropdown
                                value={draft.sourceLanguage}
                                ariaLabel={t('Source language')}
                                options={[
                                    { value: 'zh-CN', label: t('Simplified Chinese') },
                                    { value: 'zh-TW', label: t('Traditional Chinese') },
                                    { value: 'en-US', label: t('English') }
                                ]}
                                onValueChange={(value) =>
                                    update('sourceLanguage', value as ShortDramaProjectInput['sourceLanguage'])
                                }
                            />
                        </label>
                        <label className={styles.field}>
                            {t('Voice language')}
                            <Dropdown
                                value={draft.voiceLanguage}
                                ariaLabel={t('Voice language')}
                                options={[
                                    { value: 'silent', label: t('Silent') },
                                    { value: 'zh-CN', label: t('Simplified Chinese') },
                                    { value: 'en-US', label: t('English') }
                                ]}
                                onValueChange={(value) =>
                                    update('voiceLanguage', value as ShortDramaProjectInput['voiceLanguage'])
                                }
                            />
                        </label>
                        <label className={styles.field}>
                            {t('Aspect Ratio')}
                            <Dropdown
                                value={draft.targetRatio}
                                ariaLabel={t('Aspect Ratio')}
                                options={RATIOS.map((value) => ({ value, label: value }))}
                                onValueChange={(value) => update('targetRatio', value)}
                            />
                        </label>
                        <label className={styles.field}>
                            {t('Resolution')}
                            <Dropdown
                                value={draft.targetResolution}
                                ariaLabel={t('Resolution')}
                                options={RESOLUTIONS.map((value) => ({ value, label: value }))}
                                onValueChange={(value) => update('targetResolution', value)}
                            />
                        </label>
                        <label className={`${styles.field} ${styles.wide}`}>
                            {t('Video model')}
                            <Dropdown
                                value={draft.generationModel}
                                ariaLabel={t('Video model')}
                                options={SEEDANCE_MODELS.map((model) => ({ value: model.id, label: model.label }))}
                                onValueChange={(value) => update('generationModel', value)}
                            />
                        </label>
                        <label className={styles.field}>
                            {t('Subtitle mode')}
                            <Dropdown
                                value={draft.subtitleMode}
                                ariaLabel={t('Subtitle mode')}
                                options={[
                                    { value: 'none', label: t('None') },
                                    { value: 'source', label: t('Follow source language') }
                                ]}
                                onValueChange={(value) =>
                                    update('subtitleMode', value as ShortDramaProjectInput['subtitleMode'])
                                }
                            />
                        </label>
                        <label className={`${styles.field} ${styles.wide}`}>
                            {t('Creative style')}
                            <textarea
                                rows={2}
                                value={draft.styleNote}
                                onChange={(event) => update('styleNote', event.target.value)}
                            />
                        </label>
                        <label className={`${styles.field} ${styles.wide}`}>
                            {t('Base prompt')}
                            <textarea
                                rows={3}
                                value={draft.basePrompt}
                                onChange={(event) => update('basePrompt', event.target.value)}
                            />
                        </label>
                    </div>
                    <label className={styles.check}>
                        <input
                            type='checkbox'
                            checked={draft.watermark}
                            onChange={(event) => update('watermark', event.target.checked)}
                        />
                        {t('Add watermark')}
                    </label>
                    {draft.watermark && (
                        <label className={styles.field}>
                            {t('Watermark text')}
                            <input
                                value={draft.watermarkText ?? ''}
                                onChange={(event) => update('watermarkText', event.target.value)}
                            />
                        </label>
                    )}
                    <div className={styles.actions}>
                        <button type='button' className={styles.secondary} onClick={() => onOpenChange(false)}>
                            {t('Cancel')}
                        </button>
                        <button type='submit' className={styles.primary} disabled={!valid || conflict}>
                            {t('Save')}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
