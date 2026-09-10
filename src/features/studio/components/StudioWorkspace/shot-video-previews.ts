import type { ShotVideoPreview } from '@/features/generation/components/CreationForm';
import type { VideoMetadata } from '@/shared/contracts/video';
import type { VideoJob } from '@/shared/contracts/video';

type Input = {
    history: VideoMetadata[];
    activeJobs: Map<string, VideoJob>;
    projectId: string;
    getVideoSrc: (id: string) => string | null | undefined;
    getThumbnailSrc: (id: string) => string | null | undefined;
};

function previewStatus(item: VideoMetadata, job?: VideoJob): ShotVideoPreview['status'] {
    if (item.status === 'completed' || job?.status === 'completed') return 'completed';
    if (item.status === 'failed' || job?.status === 'failed') return 'failed';
    if (item.status === 'submitting' || job?.status === 'queued') return 'queued';
    return 'processing';
}

export function shotVideoPreviewsForProject({ history, activeJobs, projectId, getVideoSrc, getThumbnailSrc }: Input) {
    const previews = new Map<number, ShotVideoPreview>();
    for (const item of history) {
        const shot = item.createParams?.episode_shot;
        if (!shot || item.createParams?.production?.project.id !== projectId) continue;
        const job = activeJobs.get(item.id);
        previews.set(shot.shotIndex, {
            shotIndex: shot.shotIndex,
            status: previewStatus(item, job),
            progress: item.progress ?? job?.progress ?? 0,
            jobId: item.id,
            generatedAt: item.timestamp,
            hasAudio: item.createParams?.generate_audio === true,
            videoSrc: getVideoSrc(item.id) ?? item.storedUrl ?? item.providerUrl,
            thumbnailSrc: getThumbnailSrc(item.id),
            cost: item.costDetails?.totalCost,
            error: item.error ?? job?.error?.message
        });
    }
    return Array.from(previews.values()).sort((a, b) => a.shotIndex - b.shotIndex);
}
