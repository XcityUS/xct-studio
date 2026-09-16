import { assetIdFromReferenceUrl } from '@/features/assets/reference/origin';
import { db } from '@/features/assets/storage/db';
import type { AssetBindingOptions, SceneAssetBindingProgress } from '@/features/generation/components/CreationForm/types';
import type { EditorDraft } from '@/features/script/components/ShotBuilderDialog/draft';
import type { GeneratedImage } from '@/lib/image-service';
import { uploadReferenceImage, type UserAsset } from '@/lib/media-archive';

type AutoBindCharacterAssetsInput = {
    draft: EditorDraft;
    imageAssets: UserAsset[];
    imageModel: string;
    uploadEnabled: boolean;
    assetGroupName: string;
    basePrompt: string;
    styleNote: string;
    loadImageAssets: () => Promise<UserAsset[]>;
    generateImages: (params: { prompt: string; model: string; size: '1024x1024'; n: number }) => Promise<GeneratedImage[]>;
    reviewAsset: (input: {
        url: string;
        name: string;
        groupName: string;
        origin: 'thirdparty-ai';
        assetType: 'Image';
    }) => Promise<string>;
    resolveKey: () => Promise<string | null>;
    onProgress?: (draft: EditorDraft, progress: SceneAssetBindingProgress) => void;
    options?: AssetBindingOptions;
};

function characterMatchTerms(character: EditorDraft['characters'][number]) {
    return [character.name, ...character.aliases]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}

function findCharacterImageAsset(
    character: EditorDraft['characters'][number],
    assets: UserAsset[],
    usedUrls: ReadonlySet<string>
) {
    const terms = characterMatchTerms(character);
    if (terms.length === 0) return undefined;
    return assets.find((asset) => {
        const name = asset.name?.trim().toLowerCase() ?? '';
        return asset.kind === 'image' && asset.url && !usedUrls.has(asset.url) && terms.some((term) => name.includes(term));
    });
}

function shotTextForCharacterMatch(shot: EditorDraft['shots'][number]) {
    return [
        shot.description,
        shot.prompt,
        shot.camera,
        shot.audio,
        shot.subtitle,
        ...(shot.dialogues ?? []).map((dialogue) => dialogue.text)
    ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();
}

function shotUsesCharacter(shot: EditorDraft['shots'][number], character: EditorDraft['characters'][number]) {
    if (shot.characterIds?.includes(character.id)) return true;
    if (shot.dialogues?.some((dialogue) => dialogue.speakerCharacterId === character.id)) return true;
    const terms = characterMatchTerms(character);
    if (terms.length === 0) return false;
    const shotText = shotTextForCharacterMatch(shot);
    return terms.some((term) => shotText.includes(term));
}

function characterShotContexts(draft: EditorDraft, character: EditorDraft['characters'][number]) {
    return draft.shots
        .map((shot, index) => ({ shot, index }))
        .filter(({ shot }) => shotUsesCharacter(shot, character))
        .slice(0, 4)
        .map(({ shot, index }) =>
            [
                `Shot ${index + 1}: ${shot.description}`,
                shot.prompt ? `Prompt: ${shot.prompt}` : '',
                shot.dialogues?.length ? `Dialogue: ${shot.dialogues.map((dialogue) => dialogue.text).join(' / ')}` : ''
            ]
                .filter(Boolean)
                .join('\n')
        );
}

function characterImagePrompt(
    input: Pick<AutoBindCharacterAssetsInput, 'basePrompt' | 'styleNote' | 'draft'>,
    character: EditorDraft['characters'][number]
) {
    const shotContexts = characterShotContexts(input.draft, character);
    return [
        input.basePrompt,
        input.styleNote,
        `Character reference portrait: ${character.name}`,
        character.description,
        shotContexts.length ? 'Matched storyboard context for this exact character:' : '',
        ...shotContexts,
        'Create one clean character reference image for asset binding.',
        'Generate only this matched character, not unrelated background people from the scene.',
        'The person must be front-facing with a clear full frontal face, eyes looking toward camera, head-and-shoulders portrait.',
        'Single person only, neutral expression, consistent natural lighting, no side profile, no back view, no occluded face, no text, no watermark.'
    ]
        .filter(Boolean)
        .join('\n');
}

async function generatedCharacterImageUrl(
    input: AutoBindCharacterAssetsInput,
    character: EditorDraft['characters'][number]
) {
    const prompt = characterImagePrompt(input, character);
    const [image] = await input.generateImages({ prompt, model: input.imageModel, size: '1024x1024', n: 1 });
    const createdAt = Date.now();
    await db.images.put({
        id: `character_${character.id}_${createdAt}`,
        prompt,
        model: input.imageModel,
        size: '1024x1024',
        blob: image.blob,
        source_url: image.url,
        created_at: createdAt
    });
    if (!image.blob || !input.uploadEnabled) return image.url;
    const key = await input.resolveKey();
    if (!key) throw new Error('Sign in at xcity.ai first.');
    const file = new File([image.blob], `${character.name}.png`, { type: image.blob.type || 'image/png' });
    return uploadReferenceImage(file, key, character.name);
}

export async function autoBindCharacterAssets(input: AutoBindCharacterAssetsInput): Promise<EditorDraft> {
    if (!input.imageModel) throw new Error('Image generation is not configured.');
    const latestAssets = [...input.imageAssets, ...(await input.loadImageAssets())];
    const usedUrls = new Set<string>();
    let nextDraft = structuredClone(input.draft);
    const charactersToBind = input.draft.characters.filter(
        (character) =>
            (input.options?.targetId
                ? character.id === input.options.targetId
                : input.options?.forceGenerate || !character.assetId) &&
            character.presence === 'on_screen' &&
            input.draft.shots.some((shot) => shotUsesCharacter(shot, character))
    );
    let completed = 0;

    for (const character of charactersToBind) {
        try {
            input.onProgress?.(nextDraft, { done: completed, total: charactersToBind.length });
            const matchedAsset = input.options?.forceGenerate ? undefined : findCharacterImageAsset(character, latestAssets, usedUrls);
            const imageUrl = matchedAsset?.url ?? (await generatedCharacterImageUrl(input, character));
            if (!imageUrl) throw new Error('Image generation returned no usable URL.');
            usedUrls.add(imageUrl);
            const referenceUrl = await input.reviewAsset({
                url: imageUrl,
                name: character.name,
                groupName: input.assetGroupName,
                origin: 'thirdparty-ai',
                assetType: 'Image'
            });
            const assetId = assetIdFromReferenceUrl(referenceUrl);
            if (!assetId) throw new Error('Asset review returned no Asset ID.');
            nextDraft = {
                ...nextDraft,
                characters: nextDraft.characters.map((item) =>
                    item.id === character.id ? { ...item, assetId } : item
                )
            };
            completed += 1;
            input.onProgress?.(structuredClone(nextDraft), { done: completed, total: charactersToBind.length });
        } catch (error) {
            throw new Error(
                `${character.name}: ${error instanceof Error ? error.message : 'Character asset auto binding failed.'}`
            );
        }
    }

    return nextDraft;
}
