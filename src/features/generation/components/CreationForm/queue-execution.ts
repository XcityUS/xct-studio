import type { ShotQueueItem } from './shot-queue';
import type { CreationFormProps, ShotVideoPreview } from './types';
import { claimBusinessQueue, flushBusiness, releaseBusinessQueue } from '@/features/persistence/store';

export async function executeShotQueue(options: {
    items: ShotQueueItem[];
    limit: number;
    previews?: ShotVideoPreview[];
    onSubmit: CreationFormProps['onSubmit'];
    onUpdate: (items: ShotQueueItem[]) => void;
    onBusy: (busy: boolean) => void;
}) {
    let remaining = options.items.slice(0, options.limit);
    const deferred = options.items.slice(options.limit);
    if (!remaining.length) return;
    options.onBusy(true);
    try {
        await flushBusiness();
        while (remaining.length) {
            const item = remaining[0];
            const attemptId = await claimBusinessQueue(item.id);
            const index = item.data.episode_shot?.shotIndex;
            const replacesItemId = index
                ? options.previews?.find((preview) => preview.shotIndex === index)?.jobId
                : undefined;
            let providerSubmissionStarted = false;
            try {
                await options.onSubmit(item.data, {
                    title: item.title,
                    replacesItemId,
                    rethrowOnError: true,
                    onSubmitStage: (stage) => {
                        if (stage === 'Creating video job...') providerSubmissionStarted = true;
                    }
                });
            } catch (error) {
                if (!providerSubmissionStarted) await releaseBusinessQueue(item.id, attemptId);
                throw error;
            }
            remaining = remaining.slice(1);
            options.onUpdate([...remaining, ...deferred]);
            await flushBusiness();
        }
    } finally {
        options.onBusy(false);
    }
}
