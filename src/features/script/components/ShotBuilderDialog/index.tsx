'use client';

import { AnalysisReview } from './AnalysisReview';
import { ScriptImportField } from './ScriptImportField';
import { ShotCard } from './ShotCard';
import { recalledDraft, rememberDraft, validShots, type EditorDraft, type EditorShot } from './draft';
import styles from './index.module.scss';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { ensureShotSceneIds } from '@/features/script/scene-matching';
import type { ScriptAnalysisDraft } from '@/features/script/types';
import type { ProjectAsset } from '@/shared/contracts/production';
import { InvalidApiKeyError } from '@/shared/errors';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    referenceCount: number;
    referenceLabels?: (string | null)[];
    onBreakdownScript?: (script: string) => Promise<ScriptAnalysisDraft>;
    onDraftChange?: (draft: EditorDraft) => void;
    projectAssets?: ProjectAsset[];
    defaultDurationSeconds: number;
    minDurationSeconds: number;
    maxDurationSeconds: number;
    isGeneratingShots?: boolean;
    draftKey?: string;
};

export function ShotBuilderDialog({
    isOpen,
    onOpenChange,
    referenceCount,
    onBreakdownScript,
    onDraftChange,
    defaultDurationSeconds,
    minDurationSeconds,
    maxDurationSeconds,
    isGeneratingShots = false,
    draftKey = 'normal',
    projectAssets = []
}: Props) {
    const t = useTranslations();
    const newShot = (): EditorShot => ({
        id: crypto.randomUUID(),
        description: '',
        durationSeconds: defaultDurationSeconds
    });
    const emptyDraft = (): EditorDraft => ({
        shots: [],
        script: '',
        globalNote: '',
        automatic: false,
        characters: [],
        scenes: []
    });
    const [draft, setDraft] = React.useState<EditorDraft>(() => {
        const recalled = recalledDraft(draftKey);
        return recalled ? {
            ...recalled,
            characters: recalled.characters ?? [],
            scenes: recalled.scenes ?? [],
            shots: ensureShotSceneIds(recalled.shots, recalled.scenes ?? [])
        } : {
            ...emptyDraft(),
            shots: [{ id: 'initial', description: '', durationSeconds: defaultDurationSeconds }]
        };
    });
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [confirm, setConfirm] = React.useState<'replace' | null>(null);
    const lock = React.useRef(false);
    const persistDraft = (next: EditorDraft) => {
        rememberDraft(draftKey, next);
        onDraftChange?.(structuredClone(next));
    };
    const update = (patch: Partial<EditorDraft>) =>
        setDraft((current) => {
            const next = { ...current, ...patch };
            return { ...next, shots: ensureShotSceneIds(next.shots, next.scenes) };
        });
    const clearDraft = () => {
        const next = emptyDraft();
        setDraft(next);
        setError(null);
        setConfirm(null);
        persistDraft(next);
    };
    const ready = validShots(draft.shots, minDurationSeconds, maxDurationSeconds);
    const disabled = busy || isGeneratingShots;
    const updateShot = (id: string, patch: Partial<EditorShot>) =>
        update({ shots: draft.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)) });
    const move = (index: number, direction: -1 | 1) => {
        const next = [...draft.shots];
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        update({ shots: next });
    };
    const breakdown = async () => {
        if (!onBreakdownScript || lock.current || !draft.script.trim()) return;
        lock.current = true;
        setBusy(true);
        setError(null);
        setConfirm(null);
        try {
            const result = await onBreakdownScript(draft.script);
            if (!result.shots.length || result.shots.some((shot) => !shot.description.trim()))
                throw new Error(t('Script breakdown failed'));
            update({
                characters: result.characters,
                scenes: result.scenes,
                shots: ensureShotSceneIds(result.shots, result.scenes).map((shot) => ({
                    ...shot,
                    id: shot.id || crypto.randomUUID(),
                    durationSeconds: shot.durationSeconds ?? defaultDurationSeconds
                }))
            });
        } catch (cause) {
            const message = cause instanceof Error ? cause.message.trim() : '';
            setError(
                cause instanceof InvalidApiKeyError
                    ? t('Your Xcity API key is invalid or expired<dot> Configure a new key and retry')
                    : message
                      ? t('Script breakdown failed<colon> <lcur>error<rcur>', { error: message })
                      : t('Script breakdown failed')
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setConfirm(null);
                onOpenChange(open);
            }}>
            <DialogContent className={styles.dialog} hideCloseButton>
                <DialogClose className={styles.closeButton} aria-label={t('Close')}>
                    ×
                </DialogClose>
                <DialogHeader className={styles.header}>
                    <DialogTitle>{t('Shot Builder')}</DialogTitle>
                    <DialogDescription>
                        {t('Edit one shot per video<dot> Closing keeps this draft in this tab<comma> not in the cloud')}
                    </DialogDescription>
                </DialogHeader>
                <div className={styles.body}>
                    {error && (
                        <p className={styles.error} role='alert'>
                            {error}
                        </p>
                    )}
                    <fieldset className={styles.editor} disabled={disabled}>
                        {onBreakdownScript && (
                            <label className={styles.check}>
                                <input
                                    type='checkbox'
                                    checked={draft.automatic}
                                    onChange={(event) => update({ automatic: event.target.checked })}
                                />
                                {t('Auto breakdown from script')}
                            </label>
                        )}
                        {draft.automatic && onBreakdownScript && (
                            <section className={styles.import}>
                                <label className={styles.field}>
                                    {t('Paste a short script or scene outline')}
                                    <textarea
                                        rows={5}
                                        value={draft.script}
                                        onChange={(event) => update({ script: event.target.value })}
                                    />
                                </label>
                                <ScriptImportField
                                    disabled={disabled}
                                    value={draft.script}
                                    onChange={(script) => update({ script })}
                                    onError={setError}
                                />
                                <button
                                    type='button'
                                    className={styles.primary}
                                    disabled={!draft.script.trim()}
                                    onClick={() =>
                                        draft.shots.some(
                                            (shot) => shot.description.trim() || shot.camera?.trim() || shot.audio?.trim()
                                        )
                                            ? setConfirm('replace')
                                            : void breakdown()
                                    }>
                                    {busy ? t('Breaking down<hellip>') : t('Break into shots')}
                                </button>
                            </section>
                        )}
                        <label className={styles.field}>
                            {t('Global style <slash> continuity')}
                            <textarea
                                rows={2}
                                value={draft.globalNote}
                                onChange={(event) => update({ globalNote: event.target.value })}
                            />
                        </label>
                        <AnalysisReview
                            characters={draft.characters}
                            scenes={draft.scenes}
                            assets={projectAssets}
                            updateCharacter={(id, patch) =>
                                update({
                                    characters: draft.characters.map((character) =>
                                        character.id === id ? { ...character, ...patch } : character
                                    )
                                })
                            }
                            updateScene={(id, patch) =>
                                update({
                                    scenes: draft.scenes.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene))
                                })
                            }
                        />
                        <div className={styles.toolbar}>
                            <strong>
                                {t('Shots')} ({draft.shots.length})
                            </strong>
                            <div className={styles.toolbarActions}>
                                {!draft.automatic && (
                                    <button
                                        type='button'
                                        className={styles.secondary}
                                        onClick={() => update({ shots: [...draft.shots, newShot()] })}>
                                        {t('Add shot')}
                                    </button>
                                )}
                            </div>
                        </div>
                        {draft.shots.map((shot, index) => (
                            <ShotCard
                                key={shot.id}
                                shot={shot}
                                index={index}
                                count={draft.shots.length}
                                min={minDurationSeconds}
                                max={maxDurationSeconds}
                                referenceCount={referenceCount}
                                characters={draft.characters}
                                scenes={draft.scenes}
                                previousShotId={index > 0 ? draft.shots[index - 1].id : undefined}
                                update={(patch) => updateShot(shot.id, patch)}
                                move={(direction) => move(index, direction)}
                                remove={() => update({ shots: draft.shots.filter((item) => item.id !== shot.id) })}
                                duplicate={() =>
                                    update({
                                        shots: [
                                            ...draft.shots.slice(0, index + 1),
                                            { ...shot, id: crypto.randomUUID() },
                                            ...draft.shots.slice(index + 1)
                                        ]
                                    })
                                }
                            />
                        ))}
                    </fieldset>
                    {!ready && (
                        <p className={styles.notice}>
                            {t('Every shot needs a description and a supported whole<dash>second duration')}
                        </p>
                    )}
                    {confirm && (
                        <section className={styles.confirm} role='region' aria-label={t('Confirm operation')}>
                            <strong>{t('Replace the current shot draft<q>')}</strong>
                            <p>{t('AI breakdown will replace your edited shots only after it succeeds')}</p>
                            <div className={styles.toolbar}>
                                <button
                                    type='button'
                                    className={styles.secondary}
                                    disabled={disabled}
                                    onClick={() => setConfirm(null)}>
                                    {t('Cancel')}
                                </button>
                                <button
                                    type='button'
                                    className={styles.primary}
                                    disabled={disabled}
                                    onClick={() => void breakdown()}>
                                    {t('Confirm')}
                                </button>
                            </div>
                        </section>
                    )}
                </div>
                <div className={styles.footer}>
                    <button type='button' className={styles.secondary} disabled={disabled} onClick={clearDraft}>
                        {t('Clear')}
                    </button>
                    <button
                        type='button'
                        className={styles.secondary}
                        onClick={() => {
                            setConfirm(null);
                            onOpenChange(false);
                        }}>
                        {t('Close')}
                    </button>
                    <button
                        type='button'
                        className={styles.secondary}
                        disabled={disabled}
                        onClick={() => {
                            persistDraft(draft);
                            setConfirm(null);
                            onOpenChange(false);
                        }}>
                        {t('Save storyboard draft')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
