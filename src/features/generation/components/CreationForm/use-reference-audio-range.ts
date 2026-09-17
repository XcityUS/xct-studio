import type { AudioRange } from '@/features/generation/reference-audio/range';
import * as React from 'react';

export function useReferenceAudioRange(url: string, maxSeconds: number) {
    const [selection, setSelection] = React.useState<{ url: string; range: AudioRange }>(() => ({
        url,
        range: { startSeconds: 0, endSeconds: maxSeconds }
    }));
    const selected = selection.url === url ? selection.range : { startSeconds: 0, endSeconds: maxSeconds };
    const range =
        selected.endSeconds - selected.startSeconds > maxSeconds
            ? { startSeconds: selected.startSeconds, endSeconds: selected.startSeconds + maxSeconds }
            : selected;
    const setRange = React.useCallback((next: AudioRange) => setSelection({ url, range: next }), [url]);
    return { range, setRange };
}
