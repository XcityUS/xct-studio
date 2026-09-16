import { executeShotQueue } from './queue-execution';
import {
    readShotQueue,
    storyboardQueueSignature,
    type ShotQueueItem,
    type ShotQueueScope,
    writeShotQueue
} from './shot-queue';
import { SHOT_GENERATION_BATCH_LIMIT, storyboardVideoQueueItems } from './storyboard-video-queue';
import type { CreationFormProps } from './types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { VideoModel } from '@/shared/config/seedance';
import * as React from 'react';

type Options = {
    draft?: EditorDraft;
    draftKey: string;
    blocked: boolean;
    previews: CreationFormProps['shotVideoPreviews'];
    projectAssets: CreationFormProps['projectAssets'];
    activeSeconds: number;
    activeModel: VideoModel;
    buildSubmissionData: Parameters<typeof storyboardVideoQueueItems>[0]['buildSubmissionData'];
    onSubmit: CreationFormProps['onSubmit'];
    titleForShot: (index: number) => string;
};

export function useShotGeneration(options: Options) {
    const [isGeneratingShotBatch, setIsGeneratingShotBatch] = React.useState(false);
    const [shotQueue, setShotQueue] = React.useState<ShotQueueItem[]>([]);
    const shotQueueScope = React.useMemo<ShotQueueScope>(
        () => ({ projectKey: options.draftKey, draftSignature: storyboardQueueSignature(options.draft) }),
        [options.draftKey, options.draft]
    );
    React.useEffect(() => {
        const frame = window.requestAnimationFrame(() => setShotQueue(readShotQueue(shotQueueScope)));
        return () => window.cancelAnimationFrame(frame);
    }, [shotQueueScope]);

    const updateShotQueue = (nextQueue: ShotQueueItem[]) => {
        setShotQueue(nextQueue);
        writeShotQueue(nextQueue, shotQueueScope);
    };
    const processShotQueue = async (initialQueue = shotQueue) => {
        if (options.blocked || isGeneratingShotBatch) return;
        await executeShotQueue({
            items: initialQueue,
            limit: SHOT_GENERATION_BATCH_LIMIT,
            previews: options.previews,
            onSubmit: options.onSubmit,
            onUpdate: updateShotQueue,
            onBusy: setIsGeneratingShotBatch
        });
    };
    const queueItems = (shots: Array<{ shot: EditorDraft['shots'][number]; index: number }>) =>
        storyboardVideoQueueItems({
            draft: options.draft!,
            shots,
            projectAssets: options.projectAssets,
            activeSeconds: options.activeSeconds,
            activeModel: options.activeModel,
            buildSubmissionData: options.buildSubmissionData,
            titleForShot: options.titleForShot
        });
    const handleGenerateShot = async (shot: EditorDraft['shots'][number], index: number) => {
        if (!options.draft || options.blocked || isGeneratingShotBatch || !shot.description.trim()) return;
        const queue = queueItems([{ shot, index }]);
        updateShotQueue(queue);
        await processShotQueue(queue);
    };
    const handleGenerateAllShots = async () => {
        if (!options.draft || options.blocked || isGeneratingShotBatch) return;
        const shots = options.draft.shots
            .map((shot, index) => ({ shot, index }))
            .filter(({ shot }) => shot.description.trim());
        const items = queueItems(shots);
        if (!items.length) return;
        updateShotQueue(items);
        await processShotQueue(items);
    };
    return {
        isGeneratingShotBatch,
        pendingShotCount: shotQueue.length,
        processShotQueue,
        handleGenerateShot,
        handleGenerateAllShots
    };
}
