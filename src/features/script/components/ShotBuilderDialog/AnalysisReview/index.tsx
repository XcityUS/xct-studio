'use client';

import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import type { ScriptCharacterDraft, ScriptSceneDraft } from '@/features/script/types';
import type { ProjectAsset } from '@/shared/contracts/production';
import { useTranslations } from 'next-intl';

type Props = {
    characters: ScriptCharacterDraft[];
    scenes: ScriptSceneDraft[];
    assets: ProjectAsset[];
    updateCharacter: (id: string, patch: Partial<ScriptCharacterDraft>) => void;
    updateScene: (id: string, patch: Partial<ScriptSceneDraft>) => void;
};

export function AnalysisReview({ characters, scenes, assets, updateCharacter, updateScene }: Props) {
    const t = useTranslations();
    const characterAssets = assets.filter((asset) => asset.kind === 'character' || asset.kind === 'image');
    const sceneAssets = assets.filter((asset) => asset.kind === 'location' || asset.kind === 'image');
    const assetOptions = (items: ProjectAsset[]) => [
        { value: 'unbound', label: t('Not bound') },
        ...items.map((asset) => ({ value: asset.id, label: asset.name }))
    ];
    const presenceLabel = (presence: ScriptCharacterDraft['presence']) => {
        if (presence === 'voice_over') return t('Voice over');
        if (presence === 'narrator') return t('Narrator');
        if (presence === 'mentioned') return t('Mentioned only');
        return t('On screen');
    };

    if (!characters.length && !scenes.length) return null;
    return (
        <section className={styles.root} aria-label={t('AI analysis review')}>
            <div className={styles.heading}>
                <div>
                    <strong>{t('Review characters and scenes')}</strong>
                    <p>{t('Confirm identities and bind reusable assets before generating videos')}</p>
                </div>
                <div className={styles.summary}>
                    <span>{t('Characters<colon> <lcur>count<rcur>', { count: characters.length })}</span>
                    <span>{t('Scenes<colon> <lcur>count<rcur>', { count: scenes.length })}</span>
                </div>
            </div>
            <div className={styles.columns}>
                <div className={styles.column}>
                    <h4>{t('Characters')}</h4>
                    {characters.map((character) => (
                        <article className={styles.card} key={character.id}>
                            <div className={styles.cardTitle}>
                                <input
                                    aria-label={t('Character name')}
                                    value={character.name}
                                    onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
                                />
                                <span>{presenceLabel(character.presence)}</span>
                            </div>
                            <textarea
                                aria-label={t('Appearance description')}
                                rows={2}
                                value={character.description}
                                onChange={(event) => updateCharacter(character.id, { description: event.target.value })}
                            />
                            <label className={styles.check}>
                                <input
                                    type='checkbox'
                                    checked={character.major}
                                    onChange={(event) => updateCharacter(character.id, { major: event.target.checked })}
                                />
                                {t('Main character')}
                            </label>
                            <Dropdown
                                value={character.assetId ?? 'unbound'}
                                ariaLabel={t('Bind character asset')}
                                options={assetOptions(characterAssets)}
                                onValueChange={(value) =>
                                    updateCharacter(character.id, { assetId: value === 'unbound' ? undefined : value })
                                }
                            />
                            {character.evidence[0] && <blockquote>{character.evidence[0]}</blockquote>}
                        </article>
                    ))}
                </div>
                <div className={styles.column}>
                    <h4>{t('Scenes')}</h4>
                    {scenes.map((scene) => (
                        <article className={styles.card} key={scene.id}>
                            <input
                                aria-label={t('Scene name')}
                                value={scene.name}
                                onChange={(event) => updateScene(scene.id, { name: event.target.value })}
                            />
                            <textarea
                                aria-label={t('Scene description')}
                                rows={2}
                                value={scene.description}
                                onChange={(event) => updateScene(scene.id, { description: event.target.value })}
                            />
                            <Dropdown
                                value={scene.assetId ?? 'unbound'}
                                ariaLabel={t('Bind scene reference')}
                                options={assetOptions(sceneAssets)}
                                onValueChange={(value) =>
                                    updateScene(scene.id, { assetId: value === 'unbound' ? undefined : value })
                                }
                            />
                            {scene.evidence[0] && <blockquote>{scene.evidence[0]}</blockquote>}
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
