import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { AssetBindingOptions, SceneAssetBindingProgress } from './types';
import * as React from 'react';

type Options = {
    draft?: EditorDraft;
    onAutoBind?: (
        draft: EditorDraft,
        onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void,
        options?: AssetBindingOptions
    ) => Promise<EditorDraft>;
    onDraftChange: (draft: EditorDraft, baseDraft?: EditorDraft) => void;
    getTotal?: (draft: EditorDraft, options?: AssetBindingOptions) => number;
    fallbackError?: string;
};

export function useSceneAssetAutobind({
    draft,
    onAutoBind,
    onDraftChange,
    getTotal = (value) => value.scenes.filter((scene) => !scene.assetId).length,
    fallbackError = 'Scene asset auto binding failed.'
}: Options) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [progress, setProgress] = React.useState<SceneAssetBindingProgress | null>(null);
    const run = React.useCallback(async (options?: AssetBindingOptions) => {
        if (!draft || !onAutoBind || busy) return;
        const total = getTotal(draft, options);
        setBusy(true);
        setError(null);
        setProgress({ done: 0, total });
        try {
            const nextDraft = await onAutoBind(draft, (nextDraft, nextProgress) => {
                setProgress(nextProgress);
                onDraftChange(structuredClone(nextDraft), draft);
            }, options);
            onDraftChange(structuredClone(nextDraft), draft);
        } catch (err) {
            setError(err instanceof Error ? err.message : fallbackError);
        } finally {
            setBusy(false);
        }
    }, [busy, draft, fallbackError, getTotal, onAutoBind, onDraftChange]);
    return { busy, error, progress, run: onAutoBind ? run : undefined };
}
