import { PROMPT_TEMPLATE_CATEGORIES } from '@/features/script/prompt/templates';
import { type VideoRatio } from '@/shared/config/seedance';

export const RATIO_LABELS: Record<VideoRatio, string> = {
    '16:9': '16:9 · Landscape',
    '9:16': '9:16 · Portrait',
    '1:1': '1:1 · Square',
    '4:3': '4:3 · Classic',
    '21:9': '21:9 · Cinematic'
};

export const CAMERA_TEMPLATES =
    PROMPT_TEMPLATE_CATEGORIES.find((category) => category.id === 'camera')?.templates ?? [];

export const nativeRangeClass =
    'h-6 w-full cursor-pointer accent-white disabled:cursor-not-allowed disabled:opacity-50';

export const nativeCheckboxClass =
    'h-4 w-4 shrink-0 rounded border border-white/40 bg-black accent-white disabled:cursor-not-allowed disabled:opacity-40';
