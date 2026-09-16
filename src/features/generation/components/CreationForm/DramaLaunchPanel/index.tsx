import styles from './index.module.scss';
import { StoryboardDraftPanel } from '../StoryboardDraftPanel';
import type { AssetBindingOptions, SceneAssetBindingProgress, ShortDramaProjectControls, ShotVideoPreview } from '../types';
import { ProjectManagementControls } from '@/features/projects/components/ProjectManagementControls';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import { ReviewFindingsPanel } from '@/features/script/components/ShotBuilderDialog/ReviewFindingsPanel';
import { reviewStoryboard } from '@/features/script/review/storyboard';
import type { ProjectAsset } from '@/shared/contracts/production';
import { Clapperboard } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
    disabled: boolean;
    onOpen: () => void;
    projectControls?: ShortDramaProjectControls;
    storyboardDraft?: EditorDraft;
    minDurationSeconds: number;
    maxDurationSeconds: number;
    projectAssets: ProjectAsset[];
    onOpenAssets?: () => void;
    onDraftChange: (draft: EditorDraft) => void;
    onGenerateShot?: (shot: EditorDraft['shots'][number], index: number) => void | Promise<void>;
    onGenerateAllShots?: () => void | Promise<void>;
    isGeneratingShot?: boolean;
    pendingShotCount?: number;
    shotVideoPreviews?: ShotVideoPreview[];
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

function WorkflowActions({
    disabled,
    onOpen
}: Pick<Props, 'disabled' | 'onOpen'>) {
    const t = useTranslations();
    return (
        <div className={styles.actions}>
            <button type='button' className={styles.button} disabled={disabled} onClick={onOpen}>
                {t('Open storyboard')}
            </button>
        </div>
    );
}

export function DramaLaunchPanel({
    disabled,
    onOpen,
    projectControls,
    storyboardDraft,
    minDurationSeconds,
    maxDurationSeconds,
    projectAssets,
    onOpenAssets,
    onDraftChange,
    onGenerateShot,
    onGenerateAllShots,
    isGeneratingShot,
    pendingShotCount = 0,
    shotVideoPreviews = [],
    onContinueShotQueue,
    onAutoBindSceneAssets,
    isAutoBindingSceneAssets,
    sceneAssetBindingError,
    sceneAssetBindingProgress,
    onAutoBindCharacterAssets,
    onRefreshAssetStatus,
    isAutoBindingCharacterAssets,
    characterAssetBindingError,
    characterAssetBindingProgress
}: Props) {
    const t = useTranslations();
    const reviewFindings = storyboardDraft
        ? reviewStoryboard({ draft: storyboardDraft, minDurationSeconds, maxDurationSeconds })
        : [];
    const blockedShotIds = new Set(
        reviewFindings.filter((finding) => finding.severity === 'blocking').map((finding) => finding.shotId)
    );
    if (reviewFindings.some((finding) => finding.code === 'UNBOUND_CHARACTER_ASSET' || finding.code === 'UNBOUND_SCENE_ASSET')) {
        storyboardDraft?.shots.forEach((shot) => blockedShotIds.add(shot.id));
    }

    return (
        <section className={styles.panel} aria-label={t('Short Drama workflow')}>
            {projectControls && <ProjectManagementControls {...projectControls} />}
            <div className={styles.action}>
                <span className={styles.icon} aria-hidden='true'>
                    <Clapperboard size={22} />
                </span>
                <div className={styles.copy}>
                    <h3>{t('Create shots from a script')}</h3>
                    <p>
                        {t('Project settings control the model<comma> language<comma> format and output for every shot')}
                    </p>
                </div>
                <WorkflowActions
                    disabled={disabled}
                    onOpen={onOpen}
                />
            </div>
            {storyboardDraft?.shots.length ? (
                <>
                    <ReviewFindingsPanel
                        draft={storyboardDraft}
                        minDurationSeconds={minDurationSeconds}
                        maxDurationSeconds={maxDurationSeconds}
                    />
                    <StoryboardDraftPanel
                        draft={storyboardDraft}
                        assets={projectAssets}
                        onOpenAssets={onOpenAssets}
                        onDraftChange={onDraftChange}
                        onGenerateShot={onGenerateShot}
                        onGenerateAllShots={onGenerateAllShots}
                        isGeneratingShot={isGeneratingShot}
                        blockedShotIds={blockedShotIds}
                        pendingShotCount={pendingShotCount}
                        shotVideoPreviews={shotVideoPreviews}
                        onContinueShotQueue={onContinueShotQueue}
                        onAutoBindSceneAssets={onAutoBindSceneAssets}
                        isAutoBindingSceneAssets={isAutoBindingSceneAssets}
                        sceneAssetBindingError={sceneAssetBindingError}
                        sceneAssetBindingProgress={sceneAssetBindingProgress}
                        onAutoBindCharacterAssets={onAutoBindCharacterAssets}
                        onRefreshAssetStatus={onRefreshAssetStatus}
                        isAutoBindingCharacterAssets={isAutoBindingCharacterAssets}
                        characterAssetBindingError={characterAssetBindingError}
                        characterAssetBindingProgress={characterAssetBindingProgress}
                    />
                </>
            ) : null}
        </section>
    );
}
