import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { SceneAssetBindingProgress } from './types';
import * as React from 'react';

type Options = {
    draft?: EditorDraft;
    onAutoBind?: (
        draft: EditorDraft,
        onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void
    ) => Promise<EditorDraft>;
    onDraftChange: (draft: EditorDraft) => void;
};

export function useSceneAssetAutobind({ draft, onAutoBind, onDraftChange }: Options) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [progress, setProgress] = React.useState<SceneAssetBindingProgress | null>(null);
    const run = React.useCallback(async () => {
        if (!draft || !onAutoBind || busy) return;
        const total = draft.scenes.filter((scene) => !scene.assetId).length;
        setBusy(true);
        setError(null);
        setProgress({ done: 0, total });
        try {
            const nextDraft = await onAutoBind(draft, (nextDraft, nextProgress) => {
                setProgress(nextProgress);
                onDraftChange(structuredClone(nextDraft));
            });
            onDraftChange(structuredClone(nextDraft));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Scene asset auto binding failed.');
        } finally {
            setBusy(false);
        }
    }, [busy, draft, onAutoBind, onDraftChange]);
    return { busy, error, progress, run: onAutoBind ? run : undefined };
}
