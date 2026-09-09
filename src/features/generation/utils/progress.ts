/**
 * Display progress for an in-flight video job. The gateway rarely reports a
 * real percentage for BytePlus jobs (it usually stays 0 until completion), so
 * the UI blends whatever the gateway said with a time-based estimate that
 * rises smoothly and asymptotically toward 97% — never claiming done, never
 * moving backwards past a real reported value.
 *
 * The time constant scales with the requested clip length: longer clips take
 * proportionally longer to render.
 */
export function estimateVideoProgress(
    createdAtSec: number,
    videoSeconds: number,
    reportedProgress: number,
    nowMs: number
): number {
    const elapsed = Math.max(0, nowMs / 1000 - createdAtSec);
    const tau = 60 + (Number.isFinite(videoSeconds) ? videoSeconds : 5) * 6;
    const simulated = 97 * (1 - Math.exp(-elapsed / tau));
    return Math.min(97, Math.max(Math.floor(simulated), Math.floor(reportedProgress) || 0));
}
