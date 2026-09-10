import styles from './index.module.scss';
import { StoryboardDraftPanel } from '../StoryboardDraftPanel';
import type { SceneAssetBindingProgress, ShortDramaProjectControls, ShotVideoPreview } from '../types';
import { ProjectManagementControls } from '@/features/projects/components/ProjectManagementControls';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { ProjectAsset } from '@/shared/contracts/production';
import { Clapperboard } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
    disabled: boolean;
    onOpen: () => void;
    projectControls?: ShortDramaProjectControls;
    storyboardDraft?: EditorDraft;
    projectAssets: ProjectAsset[];
    onOpenAssets?: () => void;
    onDraftChange: (draft: EditorDraft) => void;
    onGenerateShot?: (shot: EditorDraft['shots'][number], index: number) => void | Promise<void>;
    onGenerateAllShots?: () => void | Promise<void>;
    isGeneratingShot?: boolean;
    pendingShotCount?: number;
    shotVideoPreviews?: ShotVideoPreview[];
    onContinueShotQueue?: () => void | Promise<void>;
    onAutoBindSceneAssets?: () => void | Promise<void>;
    isAutoBindingSceneAssets?: boolean;
    sceneAssetBindingError?: string | null;
    sceneAssetBindingProgress?: SceneAssetBindingProgress | null;
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
    sceneAssetBindingProgress
}: Props) {
    const t = useTranslations();

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
                <StoryboardDraftPanel
                    draft={storyboardDraft}
                    assets={projectAssets}
                    onOpenAssets={onOpenAssets}
                    onDraftChange={onDraftChange}
                    onGenerateShot={onGenerateShot}
                    onGenerateAllShots={onGenerateAllShots}
                    isGeneratingShot={isGeneratingShot}
                    pendingShotCount={pendingShotCount}
                    shotVideoPreviews={shotVideoPreviews}
                    onContinueShotQueue={onContinueShotQueue}
                    onAutoBindSceneAssets={onAutoBindSceneAssets}
                    isAutoBindingSceneAssets={isAutoBindingSceneAssets}
                    sceneAssetBindingError={sceneAssetBindingError}
                    sceneAssetBindingProgress={sceneAssetBindingProgress}
                />
            ) : null}
        </section>
    );
}
