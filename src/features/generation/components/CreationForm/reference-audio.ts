import type { SingleImageMode } from './types';
import { SILENT_VOICE_LANGUAGE } from '@/features/script/prompt/guards';

export function canUseReferenceAudio(
    referenceCount: number,
    referenceCap: number,
    singleImageMode: SingleImageMode
): boolean {
    return referenceCap > 1 && (referenceCount !== 1 || singleImageMode === 'reference');
}

export function shouldGenerateAudio(
    voiceLanguage: string,
    referenceAudioUrl: string,
    referenceAudioAvailable: boolean
) {
    return voiceLanguage !== SILENT_VOICE_LANGUAGE || (referenceAudioAvailable && Boolean(referenceAudioUrl.trim()));
}
