'use client';

import { compileShotPrompt } from '@/features/generation/components/CreationForm/shot-queue';
import { AssetBindingPicker } from './AssetBindingPicker';
import { isUsableAssetBinding } from './AssetBindingPicker/choices';
import { useAssetReviewPolling } from './use-asset-review-polling';
import type { AssetBindingOptions, SceneAssetBindingProgress, ShotVideoPreview as ShotVideoPreviewItem } from '@/features/generation/components/CreationForm/types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { inferShotCharacterIds } from '@/features/script/character-matching';
import { Dropdown } from '@/components/ui/Dropdown';
import { requestExclusiveVideoPlayback, useExclusiveHtmlVideoPlayback } from '@/shared/media/exclusive-video-playback';
import type { ProjectAsset } from '@/shared/contracts/production';
import { Loader2, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import styles from './index.module.scss';

type Tab = 'shots' | 'characters' | 'scenes';

type Props = {
    draft?: EditorDraft;
    assets: ProjectAsset[];
    onOpenAssets?: () => void;
    onDraftChange: (draft: EditorDraft) => void;
    onGenerateShot?: (shot: EditorDraft['shots'][number], index: number) => void | Promise<void>;
    onGenerateAllShots?: () => void | Promise<void>;
    isGeneratingShot?: boolean; blockedShotIds?: ReadonlySet<string>;
    pendingShotCount?: number;
    shotVideoPreviews?: ShotVideoPreviewItem[];
    onContinueShotQueue?: () => void | Promise<void>;
    onAutoBindSceneAssets?: (options?: AssetBindingOptions) => void | Promise<void>;
    isAutoBindingSceneAssets?: boolean;
    sceneAssetBindingError?: string | null;
    sceneAssetBindingProgress?: SceneAssetBindingProgress | null;
    onAutoBindCharacterAssets?: (options?: AssetBindingOptions) => void | Promise<void>;
    onRefreshAssetStatus?: (assetId: string) => Promise<ProjectAsset['status']>;
    isAutoBindingCharacterAssets?: boolean;
    characterAssetBindingError?: string | null;
    characterAssetBindingProgress?: SceneAssetBindingProgress | null;
};

function normalizeBoundAssetId(assetId: string | undefined) {
    const value = assetId?.trim() ?? '';
    return value || undefined;
}

function videoAspectRatio(ratio: string | undefined) {
    return ratio?.replace(':', ' / ') ?? '16 / 9';
}

function ShotVideoPreviewRow({ preview }: { preview?: ShotVideoPreviewItem }) {
    const t = useTranslations();
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const playbackToken = `storyboard-shot:${preview?.jobId ?? 'empty'}`;
    useExclusiveHtmlVideoPlayback(videoRef, playbackToken);
    if (!preview) return null;
    const labels = {
        queued: t('Queued'),
        processing: t('Processing'),
        completed: t('Completed'),
        failed: t('Failed')
    };
    const copyUrl = async () => {
        if (preview.videoSrc) await navigator.clipboard.writeText(preview.videoSrc);
    };
    const generatedAt = new Date(preview.generatedAt).toLocaleString(undefined, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    return (
        <div className={styles.videoPreview} data-status={preview.status}>
            <div>
                <strong>{labels[preview.status]}</strong>
                <span>{generatedAt}</span>
                <span>{preview.hasAudio ? t('With audio') : t('Silent')}</span>
                {typeof preview.cost === 'number' && <span>${preview.cost.toFixed(4)}</span>}
                {preview.videoSrc && <button type='button' onClick={copyUrl}>{t('Copy URL')}</button>}
            </div>
            <span className={styles.videoProgress}><i style={{ width: `${preview.progress}%` }} /></span>
            {preview.videoSrc && (
                <video
                    ref={videoRef}
                    controls
                    poster={preview.thumbnailSrc ?? undefined}
                    src={preview.videoSrc}
                    style={{ aspectRatio: videoAspectRatio(preview.ratio) }}
                />
            )}
            {preview.error && <p>{preview.error}</p>}
        </div>
    );
}

function EpisodeVideoPreview({ previews, shotCount }: { previews: ShotVideoPreviewItem[]; shotCount: number }) {
    const t = useTranslations();
    const playlist = React.useMemo(
        () => previews.filter((preview) => preview.status === 'completed' && preview.videoSrc).sort((a, b) => a.shotIndex - b.shotIndex),
        [previews]
    );
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [playing, setPlaying] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const playbackToken = 'storyboard-sequence-player';
    const stopPlaying = React.useCallback(() => setPlaying(false), []);
    useExclusiveHtmlVideoPlayback(videoRef, playbackToken, stopPlaying);
    const safeActiveIndex = Math.min(activeIndex, Math.max(playlist.length - 1, 0));
    const active = playlist[safeActiveIndex];
    const next = playlist[safeActiveIndex + 1];
    React.useEffect(() => {
        if (!playing || !videoRef.current) return;
        videoRef.current.load();
        void videoRef.current.play().catch(() => setPlaying(false));
    }, [active?.videoSrc, playing]);
    if (shotCount === 0) return null;
    const missing = Math.max(shotCount - playlist.length, 0);
    return (
        <aside className={`${styles.videoPreview} ${styles.episodePreview}`}>
            <div>
                <strong>{t('Video Output')}</strong>
                <span>{t('Ready <lcur>ready<rcur><slash><lcur>total<rcur> shots', { ready: playlist.length, total: shotCount })}</span>
                {missing > 0 && <span>{t('<lcur>count<rcur> missing', { count: missing })}</span>}
                <button type='button' disabled={!active} onClick={() => { requestExclusiveVideoPlayback(playbackToken); setActiveIndex(0); setPlaying(true); }}>
                    {t('Play output')}
                </button>
            </div>
            {active ? (
                <>
                    <span className={styles.videoProgress}><i style={{ width: `${((safeActiveIndex + 1) / playlist.length) * 100}%` }} /></span>
                    <video
                        ref={videoRef}
                        controls
                        poster={active.thumbnailSrc ?? undefined}
                        src={active.videoSrc}
                        preload='auto'
                        style={{ aspectRatio: videoAspectRatio(active.ratio) }}
                        onEnded={() => (safeActiveIndex + 1 < playlist.length ? setActiveIndex(safeActiveIndex + 1) : setPlaying(false))}
                    />
                    {next?.videoSrc && (
                        <video
                            aria-hidden='true'
                            className={styles.preloadVideo}
                            preload='auto'
                            src={next.videoSrc}
                        />
                    )}
                    <p>{t('Shot <lcur>number<rcur>', { number: active.shotIndex })}</p>
                </>
            ) : (
                <p>{t('No completed storyboard videos yet')}</p>
            )}
        </aside>
    );
}

export function StoryboardDraftPanel({
    draft,
    assets,
    onOpenAssets,
    onDraftChange,
    onGenerateShot,
    onGenerateAllShots,
    isGeneratingShot = false, blockedShotIds,
    pendingShotCount = 0,
    shotVideoPreviews = [],
    onContinueShotQueue,
    onAutoBindSceneAssets,
    isAutoBindingSceneAssets = false,
    sceneAssetBindingError,
    sceneAssetBindingProgress,
    onAutoBindCharacterAssets,
    onRefreshAssetStatus,
    isAutoBindingCharacterAssets = false,
    characterAssetBindingError,
    characterAssetBindingProgress
}: Props) {
    const t = useTranslations();
    const [tab, setTab] = React.useState<Tab>('shots');
    const [editingShotId, setEditingShotId] = React.useState<string | undefined>();
    const reviewAttempts = useAssetReviewPolling(
        draft?.shots.length ? [...draft.characters.map((character) => character.assetId), ...draft.scenes.map((scene) => scene.assetId)] : [],
        assets,
        onRefreshAssetStatus
    );
    if (!draft || draft.shots.length === 0) return null;

    const totalDuration = draft.shots.reduce((sum, shot) => sum + (shot.durationSeconds ?? 0), 0);
    const sceneBindingPercent = sceneAssetBindingProgress?.total ? Math.round((sceneAssetBindingProgress.done / sceneAssetBindingProgress.total) * 100) : 0;
    const characterBindingPercent = characterAssetBindingProgress?.total ? Math.round((characterAssetBindingProgress.done / characterAssetBindingProgress.total) * 100) : 0;
    const sceneAssetBindingTargetId = sceneAssetBindingProgress?.targetId;
    const characterAssetBindingTargetId = characterAssetBindingProgress?.targetId;
    const sceneNames = new Map(draft.scenes.map((scene) => [scene.id, scene.name]));
    const sceneOptions = [{ value: 'unbound', label: t('No scene') }, ...draft.scenes.map((scene) => ({ value: scene.id, label: scene.name }))];
    const updateShot = (id: string, patch: Partial<EditorDraft['shots'][number]>) =>
        onDraftChange({ ...draft, shots: draft.shots.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)) });
    const toggleShotCharacter = (shotId: string, characterId: string, selected: boolean) => {
        const shot = draft.shots.find((item) => item.id === shotId);
        const currentIds = shot?.characterIds ?? [];
        updateShot(shotId, {
            characterIds: selected ? [...currentIds, characterId] : currentIds.filter((id) => id !== characterId),
            characterSelectionMode: 'manual'
        });
    };
    const updateCharacterAsset = (id: string, assetId?: string) =>
        onDraftChange({
            ...draft,
            characters: draft.characters.map((character) =>
                character.id === id ? { ...character, assetId: normalizeBoundAssetId(assetId) } : character
            )
        });
    const updateSceneAsset = (id: string, assetId?: string) =>
        onDraftChange({
            ...draft,
            scenes: draft.scenes.map((scene) =>
                scene.id === id ? { ...scene, assetId: normalizeBoundAssetId(assetId) } : scene
            )
        });

    return (
        <section className={styles.panel} aria-label={t('Current storyboard draft')}>
            <div className={styles.header}>
                <div>
                    <h3>{t('Current storyboard draft')}</h3>
                    <p>
                        {t(
                            '<lcur>count<rcur> shots<dot> <lcur>number<rcur> characters<dot> <lcur>limit<rcur> scenes<dot> <lcur>seconds<rcur>s',
                            {
                                count: draft.shots.length,
                                number: draft.characters.length,
                                limit: draft.scenes.length,
                                seconds: totalDuration
                            }
                        )}
                    </p>
                </div>
                {pendingShotCount > 0 && (
                    <button type='button' className={styles.primaryButton} disabled={isGeneratingShot} onClick={onContinueShotQueue}>
                        {t('Continue queue <lpar><lcur>count<rcur><rpar>', { count: pendingShotCount })}
                    </button>
                )}
                {pendingShotCount === 0 && onGenerateAllShots && (
                    <button type='button' className={styles.primaryButton} disabled={isGeneratingShot || Boolean(blockedShotIds?.size)} onClick={onGenerateAllShots}>
                        {isGeneratingShot ? t('Producing') : draft.characters.some((item) => !item.assetId?.trim()) || draft.scenes.some((item) => !item.assetId?.trim()) ? t('Bind characters and scenes before production') : blockedShotIds?.size ? t('Resolve blocking issues first') : t('Start production')}
                    </button>
                )}
            </div>
            <div className={styles.tabs} role='tablist' aria-label={t('Storyboard workspace tabs')}>
                {[
                    ['shots', t('Storyboard'), draft.shots.length],
                    ['characters', t('Character binding'), draft.characters.length],
                    ['scenes', t('Scene binding'), draft.scenes.length]
                ].map(([value, label, count]) => (
                    <button
                        key={value}
                        type='button'
                        role='tab'
                        aria-selected={tab === value}
                        className={tab === value ? styles.activeTab : undefined}
                        onClick={() => setTab(value as Tab)}>
                        {label} <span>{count}</span>
                    </button>
                ))}
            </div>
            {tab === 'characters' && (
                <section className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <strong>{t('Character asset bindings')}</strong>
                        <div className={styles.sectionActions}>
                            {onOpenAssets && (
                                <button type='button' className={styles.textButton} onClick={onOpenAssets}>
                                    {t('Upload or add image assets')}
                                </button>
                            )}
                            {onAutoBindCharacterAssets && draft.characters.length > 0 && (
                                <button type='button' className={styles.textButton} disabled={isAutoBindingCharacterAssets} onClick={() => onAutoBindCharacterAssets({ forceGenerate: true })}>
                                    {isAutoBindingCharacterAssets && !characterAssetBindingTargetId ? <Loader2 className={styles.spinner} size={13} /> : <Wand2 size={13} />}
                                    {isAutoBindingCharacterAssets && !characterAssetBindingTargetId ? t('Batch updating') : t('Batch update')}
                                </button>
                            )}
                            {onAutoBindCharacterAssets && draft.characters.some((character) => !character.assetId) && (
                                <button type='button' className={styles.textButton} disabled={isAutoBindingCharacterAssets} onClick={() => onAutoBindCharacterAssets()}>
                                    {isAutoBindingCharacterAssets && !characterAssetBindingTargetId ? <Loader2 className={styles.spinner} size={13} /> : <Wand2 size={13} />}
                                    {isAutoBindingCharacterAssets && !characterAssetBindingTargetId ? t('Binding character assets') : t('Auto bind character assets')}
                                </button>
                            )}
                        </div>
                    </div>
                    {isAutoBindingCharacterAssets && !characterAssetBindingTargetId && characterAssetBindingProgress && characterAssetBindingProgress.total > 0 && (
                        <div className={styles.progress} aria-label={t('Progress')}>
                            <span style={{ width: `${characterBindingPercent}%` }} />
                            <em>{characterAssetBindingProgress.done}/{characterAssetBindingProgress.total}</em>
                        </div>
                    )}
                    {characterAssetBindingError && !characterAssetBindingTargetId && <p className={styles.bindingError} role='alert'>{characterAssetBindingError}</p>}
                    <div className={styles.stack}>
                        {draft.characters.length === 0 ? (
                            <p className={styles.empty}>{t('No characters extracted yet')}</p>
                        ) : (
                            draft.characters.map((character) => (
                                <article className={styles.assetRow} key={character.id}>
                                    <div>
                                        <div className={styles.assetHeading}>
                                            <strong title={character.name}>{character.name}</strong>
                                            {isUsableAssetBinding(character.assetId, assets) && <span className={styles.boundTag}>{t('Bound')}</span>}
                                        </div>
                                        <p title={character.description || t('No description')}>
                                            {character.description || t('No description')}
                                        </p>
                                    </div>
                                    <AssetBindingPicker
                                        key={`${character.id}:${character.assetId ?? ''}`}
                                        assetId={character.assetId}
                                        assets={assets}
                                        ariaLabel={t('Bind character asset')}
                                        onCommit={(assetId) => updateCharacterAsset(character.id, assetId)}
                                        onRegenerate={() => onAutoBindCharacterAssets?.({ targetId: character.id, forceGenerate: true })}
                                        onRefreshAssetStatus={onRefreshAssetStatus}
                                        pollAttempt={onRefreshAssetStatus ? reviewAttempts[character.assetId ?? ''] ?? 0 : undefined}
                                        generationLabel={t('Generate character image')}
                                        generationError={characterAssetBindingTargetId === character.id ? characterAssetBindingError : null}
                                        disabled={isAutoBindingCharacterAssets}
                                        isRegenerating={isAutoBindingCharacterAssets && characterAssetBindingTargetId === character.id}
                                    />
                                </article>
                            ))
                        )}
                    </div>
                </section>
            )}
            {tab === 'scenes' && (
                <section className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <strong>{t('Scene asset bindings')}</strong>
                        <div className={styles.sectionActions}>
                            {onOpenAssets && (
                                <button type='button' className={styles.textButton} onClick={onOpenAssets}>
                                    {t('Upload or add image assets')}
                                </button>
                            )}
                            {onAutoBindSceneAssets && draft.scenes.length > 0 && (
                                <button type='button' className={styles.textButton} disabled={isAutoBindingSceneAssets} onClick={() => onAutoBindSceneAssets({ forceGenerate: true })}>
                                    {isAutoBindingSceneAssets && !sceneAssetBindingTargetId ? <Loader2 className={styles.spinner} size={13} /> : <Wand2 size={13} />}
                                    {isAutoBindingSceneAssets && !sceneAssetBindingTargetId ? t('Batch updating') : t('Batch update')}
                                </button>
                            )}
                            {onAutoBindSceneAssets && draft.scenes.some((scene) => !scene.assetId) && (
                                <button type='button' className={styles.textButton} disabled={isAutoBindingSceneAssets} onClick={() => onAutoBindSceneAssets()}>
                                    {isAutoBindingSceneAssets && !sceneAssetBindingTargetId ? <Loader2 className={styles.spinner} size={13} /> : <Wand2 size={13} />}
                                    {isAutoBindingSceneAssets && !sceneAssetBindingTargetId ? t('Binding scene assets') : t('Auto bind scene assets')}
                                </button>
                            )}
                        </div>
                    </div>
                    {isAutoBindingSceneAssets && !sceneAssetBindingTargetId && sceneAssetBindingProgress && sceneAssetBindingProgress.total > 0 && (
                        <div className={styles.progress} aria-label={t('Progress')}>
                            <span style={{ width: `${sceneBindingPercent}%` }} />
                            <em>{sceneAssetBindingProgress.done}/{sceneAssetBindingProgress.total}</em>
                        </div>
                    )}
                    {sceneAssetBindingError && !sceneAssetBindingTargetId && <p className={styles.bindingError} role='alert'>{sceneAssetBindingError}</p>}
                    <div className={styles.stack}>
                        {draft.scenes.length === 0 ? (
                            <p className={styles.empty}>{t('No scenes extracted yet')}</p>
                        ) : (
                            draft.scenes.map((scene) => (
                                <article className={styles.assetRow} key={scene.id}>
                                    <div>
                                        <div className={styles.assetHeading}>
                                            <strong title={scene.name}>{scene.name}</strong>
                                            {isUsableAssetBinding(scene.assetId, assets) && <span className={styles.boundTag}>{t('Bound')}</span>}
                                        </div>
                                        <p title={scene.description || t('No description')}>{scene.description || t('No description')}</p>
                                    </div>
                                    <AssetBindingPicker
                                        key={`${scene.id}:${scene.assetId ?? ''}`}
                                        assetId={scene.assetId}
                                        assets={assets}
                                        ariaLabel={t('Bind scene reference')}
                                        onCommit={(assetId) => updateSceneAsset(scene.id, assetId)}
                                        onRegenerate={() => onAutoBindSceneAssets?.({ targetId: scene.id, forceGenerate: true })}
                                        onRefreshAssetStatus={onRefreshAssetStatus}
                                        pollAttempt={onRefreshAssetStatus ? reviewAttempts[scene.assetId ?? ''] ?? 0 : undefined}
                                        generationLabel={t('Generate scene image')}
                                        generationError={sceneAssetBindingTargetId === scene.id ? sceneAssetBindingError : null}
                                        disabled={isAutoBindingSceneAssets}
                                        isRegenerating={isAutoBindingSceneAssets && sceneAssetBindingTargetId === scene.id}
                                    />
                                </article>
                            ))
                        )}
                    </div>
                </section>
            )}
            {tab === 'shots' && (
                <section className={styles.section}>
                    <div className={styles.sectionTitle}>
                        <strong>{t('Storyboard shot list')}</strong>
                        <span>{t('View and edit all <lcur>count<rcur> shots', { count: draft.shots.length })}</span>
                    </div>
                    <div className={styles.shotList}>
                        {draft.shots.map((shot, index) => {
                            const inferredCharacterIds = inferShotCharacterIds(shot, draft.characters);
                            const selectedCharacters = draft.characters.filter((character) =>
                                inferredCharacterIds.includes(character.id)
                            );
                            const names = selectedCharacters.map((character) => character.name);
                            const characterAssetsBound =
                                selectedCharacters.length > 0 && selectedCharacters.every((character) => character.assetId);
                            const hasCharacterSelection = selectedCharacters.length > 0;
                            const promptPreview = compileShotPrompt(shot, index, draft.shots.length);
                            const editing = editingShotId === shot.id;
                            return (
                                <article className={styles.shotRow} key={shot.id}>
                                    <div className={styles.shotMeta}>
                                        <strong>{t('Shot <lcur>number<rcur>', { number: index + 1 })}</strong>
                                        <span>{shot.durationSeconds ?? 0}s</span>
                                        <span>{shot.sceneId ? sceneNames.get(shot.sceneId) : t('No scene')}</span>
                                        <span className={characterAssetsBound ? styles.bound : hasCharacterSelection ? styles.unbound : undefined}>
                                            {characterAssetsBound ? t('Character assets bound') : hasCharacterSelection ? t('Character assets not bound') : t('No characters')}
                                        </span>
                                        <button type='button' onClick={() => setEditingShotId(editing ? undefined : shot.id)}>
                                            {editing ? t('Done') : t('Edit')}
                                        </button>
                                        {onGenerateShot && (
                                            <button
                                                type='button'
                                                disabled={isGeneratingShot || blockedShotIds?.has(shot.id) || !shot.description.trim()}
                                                onClick={() => void onGenerateShot(shot, index)}>
                                                {t('Generate')}
                                            </button>
                                        )}
                                    </div>
                                    {editing ? (
                                        <div className={styles.editGrid}>
                                            <label><span>{t('Description')}</span><textarea value={shot.description} onChange={(event) => updateShot(shot.id, { description: event.currentTarget.value })} /></label>
                                            <label><span>{t('Prompt')}</span><textarea value={shot.prompt ?? ''} placeholder={promptPreview} onChange={(event) => updateShot(shot.id, { prompt: event.currentTarget.value })} /></label>
                                            <label><span>{t('Scene')}</span><Dropdown value={shot.sceneId ?? 'unbound'} ariaLabel={t('Scene')} options={sceneOptions} onValueChange={(value) => updateShot(shot.id, { sceneId: value === 'unbound' ? undefined : value })} /></label>
                                            {draft.characters.length > 0 && (
                                                <fieldset className={styles.characterSelect}>
                                                    <legend>{t('Characters appearing in this shot')}</legend>
                                                    {draft.characters.map((character) => (
                                                        <label key={character.id}>
                                                            <input
                                                                type='checkbox'
                                                                checked={shot.characterIds?.includes(character.id) ?? false}
                                                                onChange={(event) =>
                                                                    toggleShotCharacter(
                                                                        shot.id,
                                                                        character.id,
                                                                        event.currentTarget.checked
                                                                    )
                                                                }
                                                            />
                                                            <span>{character.name}</span>
                                                            {character.assetId && <em>{t('Bound')}</em>}
                                                        </label>
                                                    ))}
                                                </fieldset>
                                            )}
                                            <label><span>{t('Camera')}</span><input value={shot.camera ?? ''} onChange={(event) => updateShot(shot.id, { camera: event.currentTarget.value })} /></label>
                                            <label><span>{t('Audio')}</span><input value={shot.audio ?? ''} onChange={(event) => updateShot(shot.id, { audio: event.currentTarget.value })} /></label>
                                            <label><span>{t('Subtitle')}</span><textarea value={shot.subtitle ?? ''} onChange={(event) => updateShot(shot.id, { subtitle: event.currentTarget.value })} /></label>
                                            <label><span>{t('Duration')}</span><input type='number' min={1} value={shot.durationSeconds ?? 0} onChange={(event) => updateShot(shot.id, { durationSeconds: Number(event.currentTarget.value) || 1 })} /></label>
                                        </div>
                                    ) : (
                                        <dl className={styles.params}>
                                            <div><dt>{t('Description')}</dt><dd>{shot.description}</dd></div>
                                            <div><dt>{t('Prompt')}</dt><dd>{shot.prompt?.trim() || promptPreview}</dd></div>
                                            <div><dt>{t('Characters')}</dt><dd>{names.length > 0 ? names.join(', ') : t('No characters selected for this shot')}</dd></div>
                                            <div><dt>{t('Camera')}</dt><dd>{shot.camera || t('Not set')}</dd></div>
                                            <div><dt>{t('Continuity')}</dt><dd>{shot.continuitySourceShotId || t('Not set')}</dd></div>
                                            <div><dt>{t('Audio')}</dt><dd>{shot.audio || t('Not set')}</dd></div>
                                            <div><dt>{t('Subtitle')}</dt><dd>{shot.subtitle || t('Not set')}</dd></div>
                                            <div><dt>{t('Duration')}</dt><dd>{shot.durationSeconds ?? 0}s</dd></div>
                                        </dl>
                                    )}
                                    <ShotVideoPreviewRow preview={shotVideoPreviews.find((item) => item.shotIndex === index + 1)} />
                                </article>
                            );
                        })}
                    </div>
                    <EpisodeVideoPreview previews={shotVideoPreviews} shotCount={draft.shots.length} />
                </section>
            )}
        </section>
    );
}
