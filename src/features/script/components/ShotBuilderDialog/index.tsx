'use client';

import { AnalysisReview } from './AnalysisReview';
import { ScriptImportField } from './ScriptImportField';
import { ShotCard } from './ShotCard';
import { recalledDraft, rememberDraft, validShots, type EditorDraft, type EditorShot } from './draft';
import styles from './index.module.scss';
import { inspectDraft } from './preflight';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import type { ScriptAnalysisDraft, ShotDraft } from '@/features/script/types';
import type { ProjectAsset } from '@/shared/contracts/production';
import { InvalidApiKeyError } from '@/shared/errors';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    referenceCount: number;
    referenceLabels?: (string | null)[];
    onGenerateShots?: (
        shots: ShotDraft[],
        globalNote: string,
        options: { useFormLanguageSettings: boolean }
    ) => Promise<void>;
    onBreakdownScript?: (script: string) => Promise<ScriptAnalysisDraft>;
    projectAssets?: ProjectAsset[];
    defaultDurationSeconds: number;
    minDurationSeconds: number;
    maxDurationSeconds: number;
    isGeneratingShots?: boolean;
    pendingShotCount?: number;
    onContinueShotQueue?: () => Promise<void>;
    draftKey?: string;
    generationSummary?: string;
};

export function ShotBuilderDialog({
    isOpen,
    onOpenChange,
    referenceCount,
    onGenerateShots,
    onBreakdownScript,
    defaultDurationSeconds,
    minDurationSeconds,
    maxDurationSeconds,
    isGeneratingShots = false,
    pendingShotCount = 0,
    onContinueShotQueue,
    draftKey = 'normal',
    generationSummary,
    projectAssets = []
}: Props) {
    const t = useTranslations();
    const newShot = (): EditorShot => ({
        id: crypto.randomUUID(),
        description: '',
        durationSeconds: defaultDurationSeconds
    });
    const [draft, setDraft] = React.useState<EditorDraft>(() => {
        const recalled = recalledDraft(draftKey);
        return recalled
            ? { ...recalled, characters: recalled.characters ?? [], scenes: recalled.scenes ?? [] }
            : {
                  shots: [{ id: 'initial', description: '', durationSeconds: defaultDurationSeconds }],
                  script: '',
                  globalNote: '',
                  automatic: false,
                  language: 'silent',
                  characters: [],
                  scenes: []
              };
    });
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const [confirm, setConfirm] = React.useState<'generate' | 'replace' | null>(null);
    const lock = React.useRef(false);
    React.useEffect(() => {
        rememberDraft(draftKey, draft);
    }, [draftKey, draft]);
    const update = (patch: Partial<EditorDraft>) => setDraft((current) => ({ ...current, ...patch }));
    const ready = validShots(draft.shots, minDurationSeconds, maxDurationSeconds);
    const preflight = inspectDraft(draft);
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
                shots: result.shots.map((shot) => ({
                    ...shot,
                    id: shot.id || crypto.randomUUID(),
                    durationSeconds: shot.durationSeconds ?? defaultDurationSeconds
                }))
            });
        } catch (cause) {
            setError(
                cause instanceof InvalidApiKeyError
                    ? t('Your Xcity API key is invalid or expired<dot> Configure a new key and retry')
                    : t('Script breakdown failed')
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const generate = async (continuing = false) => {
        if (lock.current || isGeneratingShots || (!continuing && !ready)) return;
        lock.current = true;
        setBusy(true);
        setError(null);
        try {
            if (continuing) await onContinueShotQueue?.();
            else
                await onGenerateShots?.(
                    draft.shots.map((shot) => {
                        const characterAssetIds = draft.characters
                            .filter((character) => shot.characterIds?.includes(character.id) && character.assetId)
                            .map((character) => character.assetId as string);
                        const sceneAssetId = draft.scenes.find((scene) => scene.id === shot.sceneId)?.assetId;
                        return {
                            ...shot,
                            assetIds: Array.from(
                                new Set([...characterAssetIds, ...(sceneAssetId ? [sceneAssetId] : [])])
                            )
                        };
                    }),
                    draft.globalNote,
                    {
                        useFormLanguageSettings: draft.language === 'form'
                    }
                );
            setConfirm(null);
            onOpenChange(false);
        } catch {
            setError(t('Could not complete the operation<dot> Your draft is still available'));
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
            <DialogContent className={styles.dialog}>
                <DialogHeader>
                    <DialogTitle>{t('Shot Builder')}</DialogTitle>
                    <DialogDescription>
                        {t('Edit one shot per video<dot> Closing keeps this draft in this tab<comma> not in the cloud')}
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <p className={styles.error} role='alert'>
                        {error}
                    </p>
                )}
                {pendingShotCount > 0 && !onContinueShotQueue && (
                    <p role='status'>{t('Pending shots belong to another project<dot> Switch back to continue')}</p>
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
                    <fieldset className={styles.language}>
                        <legend>{t('Shot language <slash> subtitles')}</legend>
                        <label className={styles.check}>
                            <input
                                type='radio'
                                name='shot-language'
                                checked={draft.language === 'silent'}
                                onChange={() => update({ language: 'silent' })}
                            />
                            {t('No generated speech or subtitles')}
                        </label>
                        <label className={styles.check}>
                            <input
                                type='radio'
                                name='shot-language'
                                checked={draft.language === 'form'}
                                onChange={() => update({ language: 'form' })}
                            />
                            {t('Use current video language and subtitle settings')}
                        </label>
                    </fieldset>
                    <div className={styles.toolbar}>
                        <strong>
                            {t('Shots')} ({draft.shots.length})
                        </strong>
                        {!draft.automatic && (
                            <button
                                type='button'
                                className={styles.secondary}
                                onClick={() => update({ shots: [...draft.shots, newShot()] })}>
                                {t('Add shot')}
                            </button>
                        )}
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
                        <strong>
                            {confirm === 'replace'
                                ? t('Replace the current shot draft<q>')
                                : t('Confirm video generation')}
                        </strong>
                        <p>
                            {confirm === 'replace'
                                ? t('AI breakdown will replace your edited shots only after it succeeds')
                                : t('Each shot creates a separate video request and may incur charges')}
                        </p>
                        {confirm === 'generate' && (
                            <>
                                <p>{generationSummary}</p>
                                <p>
                                    {t('Shots')}: {draft.shots.length} · {t('Duration')}:{' '}
                                    {draft.shots.reduce((sum, shot) => sum + (shot.durationSeconds ?? 0), 0)} s
                                </p>
                                <p>
                                    {draft.language === 'silent'
                                        ? t('No generated speech or subtitles')
                                        : t('Use current video language and subtitle settings')}
                                </p>
                                {preflight.blocking.length > 0 && (
                                    <p className={styles.error} role='alert'>
                                        {t('Main characters without assets')}: {preflight.blocking.join(', ')}
                                    </p>
                                )}
                                {preflight.warnings.length > 0 && (
                                    <p>
                                        {t('Unbound optional references')}: {preflight.warnings.join(', ')}
                                    </p>
                                )}
                                <p>
                                    {t(
                                        'This legacy queue requires this tab to stay open<dot> Background execution is not connected yet'
                                    )}
                                </p>
                            </>
                        )}
                        <div className={styles.toolbar}>
                            <button
                                type='button'
                                className={styles.secondary}
                                disabled={disabled || (confirm === 'generate' && preflight.blocking.length > 0)}
                                onClick={() => setConfirm(null)}>
                                {t('Cancel')}
                            </button>
                            <button
                                type='button'
                                className={styles.primary}
                                disabled={disabled}
                                onClick={() => (confirm === 'replace' ? void breakdown() : void generate())}>
                                {t('Confirm')}
                            </button>
                        </div>
                    </section>
                )}
                <div className={styles.footer}>
                    <button
                        type='button'
                        className={styles.secondary}
                        onClick={() => {
                            setConfirm(null);
                            onOpenChange(false);
                        }}>
                        {t('Close and keep draft')}
                    </button>
                    <button
                        type='button'
                        className={styles.secondary}
                        disabled={disabled}
                        onClick={() => {
                            rememberDraft(draftKey, draft);
                            setConfirm(null);
                            onOpenChange(false);
                        }}>
                        {t('Save draft in this tab')}
                    </button>
                    {onGenerateShots && (
                        <button
                            type='button'
                            className={styles.primary}
                            disabled={disabled || !ready || pendingShotCount > 0}
                            onClick={() => setConfirm('generate')}>
                            {t('Generate each shot')}
                        </button>
                    )}
                    {onContinueShotQueue && pendingShotCount > 0 && (
                        <button
                            type='button'
                            className={styles.primary}
                            disabled={disabled}
                            onClick={() => void generate(true)}>
                            {t('Continue queue <lpar><lcur>count<rcur><rpar>', { count: pendingShotCount })}
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
