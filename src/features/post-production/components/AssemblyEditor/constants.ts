import type { ExportFormatOption } from './types';

export const NONE_BGM_VALUE = '__none__';

export const DEFAULT_BGM_VOLUME = 60;

export const TIME_EPSILON = 0.001;

export const ORIGINAL_EXPORT_FORMAT = 'original';

export const CLOUD_XML_TOOLTIP = 'Archive to cloud first — XML references cloud URLs';

export const EXPORT_FORMATS = [
    { id: ORIGINAL_EXPORT_FORMAT, label: 'Original' },
    { id: 'vertical', label: 'TikTok / Reels · 9:16', ratio: '9:16', reframe: { width: 1080, height: 1920 } },
    { id: 'square', label: 'Square · 1:1', ratio: '1:1', reframe: { width: 1080, height: 1080 } },
    { id: 'widescreen', label: 'Widescreen · 16:9', ratio: '16:9', reframe: { width: 1920, height: 1080 } }
] as const satisfies readonly ExportFormatOption[];
