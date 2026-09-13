'use client';

import type { EditorShot } from '../draft';
import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import { PROMPT_TEMPLATE_CATEGORIES } from '@/features/script/prompt/templates';
import { usePromptTemplateLabels } from '@/features/script/prompt/use-template-labels';
import type { ScriptCharacterDraft, ScriptSceneDraft } from '@/features/script/types';
import { useTranslations } from 'next-intl';

type Props = {
    shot: EditorShot;
    index: number;
    count: number;
    min: number;
    max: number;
    update: (patch: Partial<EditorShot>) => void;
    move: (direction: -1 | 1) => void;
    remove: () => void;
    duplicate: () => void;
    referenceCount: number;
    characters: ScriptCharacterDraft[];
    scenes: ScriptSceneDraft[];
    previousShotId?: string;
};

export function ShotCard({
    shot,
    index,
    count,
    min,
    max,
    update,
    move,
    remove,
    duplicate,
    referenceCount,
    characters,
    scenes,
    previousShotId
}: Props) {
    const t = useTranslations();
    const templateLabel = usePromptTemplateLabels();
    const templates = PROMPT_TEMPLATE_CATEGORIES.find((category) => category.id === 'camera')?.templates ?? [];
    const camera = shot.camera?.trim() || '';
    const options = [
        { value: '', label: t('None') },
        ...templates.map((item) => ({ value: item.text, label: templateLabel(item.label) }))
    ];
    if (camera && !options.some((item) => item.value === camera)) options.push({ value: camera, label: camera });
    return (
        <article className={styles.card}>
            <div className={styles.toolbar}>
                <strong>{t('Shot <lcur>number<rcur>', { number: index + 1 })}</strong>
                <div className={styles.actions}>
                    <button
                        type='button'
                        disabled={index === 0}
                        onClick={() => move(-1)}
                        aria-label={t('Move shot up')}>
                        ↑
                    </button>
                    <button
                        type='button'
                        disabled={index === count - 1}
                        onClick={() => move(1)}
                        aria-label={t('Move shot down')}>
                        ↓
                    </button>
                    <button type='button' onClick={duplicate}>
                        {t('Duplicate shot')}
                    </button>
                    <button type='button' disabled={count === 1} onClick={remove}>
                        {t('Remove shot')}
                    </button>
                </div>
            </div>
            <label className={styles.field}>
                {t('Description')}
                <textarea
                    value={shot.description}
                    onChange={(event) => update({ description: event.target.value })}
                    rows={3}
                />
            </label>
            <label className={styles.field}>
                {t('Generation prompt')}
                <textarea
                    value={shot.prompt ?? ''}
                    onChange={(event) => update({ prompt: event.target.value })}
                    rows={3}
                />
            </label>
            <div className={styles.fields}>
                <label className={styles.field}>
                    {t('Scene')}
                    <Dropdown
                        value={shot.sceneId ?? 'none'}
                        ariaLabel={t('Scene')}
                        options={[
                            { value: 'none', label: t('None') },
                            ...scenes.map((scene) => ({ value: scene.id, label: scene.name }))
                        ]}
                        onValueChange={(value) => update({ sceneId: value === 'none' ? undefined : value })}
                    />
                </label>
                <label className={styles.field}>
                    {t('Continue from shot')}
                    <Dropdown
                        value={shot.continuitySourceShotId ?? 'none'}
                        ariaLabel={t('Continue from shot')}
                        options={[
                            { value: 'none', label: t('None') },
                            ...(previousShotId ? [{ value: previousShotId, label: t('Previous shot') }] : [])
                        ]}
                        onValueChange={(value) =>
                            update({ continuitySourceShotId: value === previousShotId ? previousShotId : undefined })
                        }
                    />
                </label>
            </div>
            {characters.length > 0 && (
                <fieldset className={styles.characterList}>
                    <legend>{t('Characters appearing in this shot')}</legend>
                    <p>{t('These selections decide which bound character assets are attached when this shot is generated')}</p>
                    {characters.map((character) => {
                        const selected = shot.characterIds?.includes(character.id) ?? false;
                        return (
                            <label className={styles.characterOption} key={character.id}>
                                <input
                                    type='checkbox'
                                    checked={selected}
                                    onChange={(event) =>
                                        update({
                                            characterSelectionMode: 'manual',
                                            characterIds: event.target.checked
                                                ? [...(shot.characterIds ?? []), character.id]
                                                : (shot.characterIds ?? []).filter((id) => id !== character.id)
                                        })
                                    }
                                />
                                <span>{character.name}</span>
                                <em title={character.assetId ? t('Bound') : t('Not bound')} data-bound={character.assetId ? 'true' : 'false'} />
                            </label>
                        );
                    })}
                </fieldset>
            )}
            {(shot.dialogues?.length ?? 0) > 0 && (
                <div className={styles.dialogues}>
                    <strong>{t('Dialogue')}</strong>
                    {shot.dialogues?.map((dialogue, dialogueIndex) => (
                        <div className={styles.dialogue} key={`${shot.id}-dialogue-${dialogueIndex}`}>
                            <Dropdown
                                value={dialogue.speakerCharacterId ?? 'none'}
                                ariaLabel={t('Speaker')}
                                options={[
                                    { value: 'none', label: t('Unknown speaker') },
                                    ...characters.map((character) => ({ value: character.id, label: character.name }))
                                ]}
                                onValueChange={(value) =>
                                    update({
                                        dialogues: shot.dialogues?.map((item, currentIndex) =>
                                            currentIndex === dialogueIndex
                                                ? { ...item, speakerCharacterId: value === 'none' ? undefined : value }
                                                : item
                                        )
                                    })
                                }
                            />
                            <input
                                value={dialogue.text}
                                aria-label={t('Dialogue text')}
                                onChange={(event) =>
                                    update({
                                        dialogues: shot.dialogues?.map((item, currentIndex) =>
                                            currentIndex === dialogueIndex
                                                ? { ...item, text: event.target.value }
                                                : item
                                        )
                                    })
                                }
                            />
                        </div>
                    ))}
                </div>
            )}
            <label className={styles.field}>
                {t('Subtitle text')}
                <textarea
                    value={shot.subtitle ?? ''}
                    onChange={(event) => update({ subtitle: event.target.value })}
                    rows={2}
                />
            </label>
            {referenceCount > 0 && (
                <div className={styles.actions}>
                    <span>{t('Insert reference<colon>')}</span>
                    {Array.from({ length: referenceCount }, (_, n) => n + 1).map((n) => (
                        <button
                            type='button'
                            key={n}
                            onClick={() => update({ description: `${shot.description} [Image ${n}]`.trim() })}>
                            [Image {n}]
                        </button>
                    ))}
                </div>
            )}
            <div className={styles.fields}>
                <label className={styles.field}>
                    {t('Duration')}
                    <input
                        type='number'
                        min={min}
                        max={max}
                        step={1}
                        value={shot.durationSeconds ?? ''}
                        onChange={(event) =>
                            update({
                                durationSeconds: event.target.value === '' ? undefined : Number(event.target.value)
                            })
                        }
                    />
                </label>
                <label className={styles.field}>
                    {t('Camera')}
                    <Dropdown
                        value={camera}
                        options={options}
                        ariaLabel={t('Camera')}
                        onValueChange={(value) => update({ camera: value })}
                    />
                </label>
                <label className={styles.field}>
                    {t('Audio cue')}
                    <input value={shot.audio ?? ''} onChange={(event) => update({ audio: event.target.value })} />
                </label>
            </div>
        </article>
    );
}
