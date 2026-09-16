import { fileNameWithoutExtension, voiceoverAssetName } from './utils';
import { validateAssetImage } from '@/features/assets/image/validation';
import { generateImages, type GeneratedImage, type ImageSizeId } from '@/lib/image-service';
import {
    listUserAssets,
    uploadReferenceAudio,
    uploadReferenceImage,
    uploadReferenceVideo,
    ttsModel,
    type UserAsset
} from '@/lib/media-archive';
import { synthesizeSpeech, type TtsVoice } from '@/lib/tts';
import type { VideoMetadata } from '@/shared/contracts/video';
import * as React from 'react';

type Options = {
    resolveKey: () => Promise<string | null>;
    uploadEnabled: boolean;
    activeTab: string;
    finalizeDialogItem: VideoMetadata | null;
};

export function useMediaActions({ resolveKey, uploadEnabled, activeTab, finalizeDialogItem }: Options) {
    const [imageAssets, setImageAssets] = React.useState<UserAsset[]>([]);
    const [isLoadingImageAssets, setIsLoadingImageAssets] = React.useState(false);
    const handleUploadImage = React.useCallback(
        async (file: File): Promise<string> => {
            const validation = await validateAssetImage(file);
            if (validation.status === 'rejected') throw new Error(validation.message);
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before uploading images.');
            return uploadReferenceImage(file, key, fileNameWithoutExtension(file.name));
        },
        [resolveKey]
    );
    const handleUploadAudio = React.useCallback(
        async (file: File): Promise<string> => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before uploading audio.');
            return uploadReferenceAudio(file, key, fileNameWithoutExtension(file.name));
        },
        [resolveKey]
    );
    const handleSynthesizeSpeech = React.useCallback(
        async (text: string, voice: TtsVoice): Promise<string> => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai to generate voiceover.');
            const model = await ttsModel();
            if (!model) throw new Error('Voiceover generation is not configured on this deployment.');
            const speech = await synthesizeSpeech(text, key, model, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL, voice);
            const assetName = voiceoverAssetName(text);
            const file = new File([speech], `${assetName}.mp3`, { type: 'audio/mpeg' });
            return uploadReferenceAudio(file, key, assetName);
        },
        [resolveKey]
    );
    const handleUploadVideo = React.useCallback(
        async (file: File): Promise<string> => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai before uploading video.');
            return uploadReferenceVideo(file, key, fileNameWithoutExtension(file.name));
        },
        [resolveKey]
    );
    const handleGenerateImages = React.useCallback(
        async (params: { prompt: string; model: string; size: ImageSizeId; n: number }): Promise<GeneratedImage[]> => {
            const key = await resolveKey();
            if (!key) throw new Error('Sign in at xcity.ai to generate images.');
            return generateImages(params, key, process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL);
        },
        [resolveKey]
    );
    const handleLoadAssets = React.useCallback(async () => {
        if (!uploadEnabled) return [];
        const key = await resolveKey();
        if (!key) throw new Error('Sign in at xcity.ai to view your assets.');
        return listUserAssets(key);
    }, [resolveKey, uploadEnabled]);
    const refreshImageAssets = React.useCallback(async () => {
        if (!uploadEnabled) {
            setImageAssets([]);
            return;
        }
        setIsLoadingImageAssets(true);
        try {
            const assets = await handleLoadAssets();
            setImageAssets(assets.filter((asset) => asset.kind === 'image'));
        } catch (error) {
            console.warn('Could not load image assets:', error);
            setImageAssets([]);
        } finally {
            setIsLoadingImageAssets(false);
        }
    }, [handleLoadAssets, uploadEnabled]);
    React.useEffect(() => {
        if (!finalizeDialogItem) return;
        const refreshTimer = window.setTimeout(() => void refreshImageAssets(), 0);
        return () => window.clearTimeout(refreshTimer);
    }, [finalizeDialogItem, refreshImageAssets]);
    React.useEffect(() => {
        if (activeTab !== 'image') return;
        const refreshTimer = window.setTimeout(() => void refreshImageAssets(), 0);
        return () => window.clearTimeout(refreshTimer);
    }, [activeTab, refreshImageAssets]);
    return {
        imageAssets,
        isLoadingImageAssets,
        handleUploadImage,
        handleUploadAudio,
        handleSynthesizeSpeech,
        handleUploadVideo,
        handleGenerateImages,
        handleLoadAssets,
        refreshImageAssets
    };
}
