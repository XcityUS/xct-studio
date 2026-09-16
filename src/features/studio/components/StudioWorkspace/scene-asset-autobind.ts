import { assetIdFromReferenceUrl } from '@/features/assets/reference/origin';
import { db } from '@/features/assets/storage/db';
import type { AssetBindingOptions, SceneAssetBindingProgress } from '@/features/generation/components/CreationForm/types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { GeneratedImage, ImageSizeId } from '@/lib/image-service';
import { uploadReferenceImage, type UserAsset } from '@/lib/media-archive';
import type { VideoRatio } from '@/shared/config/seedance';

type AutoBindSceneAssetsInput = {
    draft: EditorDraft;
    imageAssets: UserAsset[];
    imageModel: string;
    ratio: VideoRatio;
    uploadEnabled: boolean;
    basePrompt: string;
    styleNote: string;
    loadImageAssets: () => Promise<UserAsset[]>;
    generateImages: (params: { prompt: string; model: string; size: ImageSizeId; n: number }) => Promise<GeneratedImage[]>;
    reviewAsset: (input: { url: string; name: string; origin: 'no-person'; assetType: 'Image' }) => Promise<string>;
    resolveKey: () => Promise<string | null>;
    onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void;
    options?: AssetBindingOptions;
};

function imageSizeForRatio(ratio: VideoRatio): ImageSizeId {
    if (ratio === '16:9') return '1280x720';
    if (ratio === '9:16') return '720x1280';
    return '1024x1024';
}

function findSceneImageAsset(sceneName: string, assets: UserAsset[], usedUrls: ReadonlySet<string>) {
    const normalizedName = sceneName.trim().toLowerCase();
    if (!normalizedName) return undefined;
    return assets.find((asset) => {
        const name = asset.name?.trim().toLowerCase() ?? '';
        return asset.kind === 'image' && asset.url && !usedUrls.has(asset.url) && name.includes(normalizedName);
    });
}

function sceneEnvironmentNotes(draft: EditorDraft, sceneId: string) {
    return draft.shots
        .map((shot, index) => ({ shot, index }))
        .filter(({ shot }) => shot.sceneId === sceneId)
        .slice(0, 4)
        .map(({ shot, index }) =>
            [
                `Shot ${index + 1} environment: ${shot.description}`,
                shot.camera ? `Camera and lighting: ${shot.camera}` : ''
            ]
                .filter(Boolean)
                .join('\n')
        )
        .filter(Boolean);
}

function sceneImagePrompt(input: Pick<AutoBindSceneAssetsInput, 'basePrompt' | 'styleNote' | 'draft'>, scene: EditorDraft['scenes'][number]) {
    const environmentNotes = sceneEnvironmentNotes(input.draft, scene.id);
    return [
        input.basePrompt,
        input.styleNote,
        `Pure background scene reference image: ${scene.name}`,
        scene.description,
        ...environmentNotes,
        'Generate the environment only: architecture, room layout, props, lighting, weather, time of day, and atmosphere.',
        'No people, no characters, no faces, no bodies, no silhouettes, no pedestrians, no crowd, no human reflections.',
        'Do not include the story characters in this background asset.',
        'Cinematic empty establishing shot, no subtitles, no text overlay, clean production reference.'
    ].filter(Boolean).join('\n');
}

async function generatedSceneImageUrl(input: AutoBindSceneAssetsInput, scene: EditorDraft['scenes'][number]) {
    const size = imageSizeForRatio(input.ratio);
    const prompt = sceneImagePrompt(input, scene);
    const [image] = await input.generateImages({ prompt, model: input.imageModel, size, n: 1 });
    const createdAt = Date.now();
    await db.images.put({
        id: `scene_${scene.id}_${createdAt}`,
        prompt,
        model: input.imageModel,
        size,
        blob: image.blob,
        source_url: image.url,
        created_at: createdAt
    });
    if (!image.blob || !input.uploadEnabled) return image.url;
    const key = await input.resolveKey();
    if (!key) throw new Error('Sign in at xcity.ai first.');
    const file = new File([image.blob], `${scene.name}.png`, { type: image.blob.type || 'image/png' });
    return uploadReferenceImage(file, key, scene.name);
}

export async function autoBindSceneAssets(input: AutoBindSceneAssetsInput): Promise<EditorDraft> {
    if (!input.imageModel) throw new Error('Image generation is not configured.');
    const latestAssets = [...input.imageAssets, ...(await input.loadImageAssets())];
    const usedUrls = new Set<string>();
    let nextDraft = structuredClone(input.draft);
    const scenesToBind = input.draft.scenes.filter((scene) => {
        if (input.options?.targetId) return scene.id === input.options.targetId;
        return input.options?.forceGenerate ? true : !scene.assetId;
    });
    let completed = 0;

    for (const scene of scenesToBind) {
        try {
            input.onProgress?.(nextDraft, { done: completed, total: scenesToBind.length });
            const matchedAsset = input.options?.forceGenerate ? undefined : findSceneImageAsset(scene.name, latestAssets, usedUrls);
            const imageUrl = matchedAsset?.url ?? (await generatedSceneImageUrl(input, scene));
            if (!imageUrl) throw new Error('Image generation returned no usable URL.');
            usedUrls.add(imageUrl);
            const referenceUrl = await input.reviewAsset({
                url: imageUrl,
                name: scene.name,
                origin: 'no-person',
                assetType: 'Image'
            });
            const assetId = assetIdFromReferenceUrl(referenceUrl);
            if (!assetId) throw new Error('Asset review returned no Asset ID.');
            nextDraft = {
                ...nextDraft,
                scenes: nextDraft.scenes.map((item) => (item.id === scene.id ? { ...item, assetId } : item))
            };
            completed += 1;
            input.onProgress?.(structuredClone(nextDraft), { done: completed, total: scenesToBind.length });
        } catch (error) {
            throw new Error(`${scene.name}: ${error instanceof Error ? error.message : 'Scene asset auto binding failed.'}`);
        }
    }

    return nextDraft;
}
