'use client';

import { estimateVideoProgress } from '@/features/generation/utils/progress';
import type { VideoJob } from '@/shared/contracts/video';
import * as React from 'react';

/**
 * Smoothly ticking display progress for a running job. The gateway rarely
 * reports a real percentage mid-flight, so this re-renders once a second and
 * blends the reported value with a time-based estimate.
 */
export function useDisplayProgress(job: VideoJob | null): number {
    const running = Boolean(job && (job.status === 'queued' || job.status === 'in_progress'));
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!running) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [running, job?.id]);

    if (!job) return 0;
    if (job.status === 'completed') return 100;
    if (!running) return job.progress || 0;
    return estimateVideoProgress(job.created_at, Number(job.seconds), job.progress, now);
}
