/**
 * Prompt inspiration library for the create form (Jimeng-style 灵感).
 *
 * Two kinds of entries:
 *  - `replace`: a complete example prompt — fills the textarea, then the user
 *    edits the subject to taste.
 *  - `append`: a short cinematic phrase (camera move, lighting, style) that is
 *    appended to whatever is already written.
 *
 * Seedance responds well to structured prompts: shot type → subject → action
 * → setting → lighting → camera. The full templates model that shape.
 */

export type PromptTemplateMode = 'replace' | 'append';

export interface PromptTemplate {
    /** Short label shown on the chip. */
    label: string;
    /** The text inserted into the prompt. */
    text: string;
    mode: PromptTemplateMode;
}

export interface PromptTemplateCategory {
    id: string;
    label: string;
    templates: PromptTemplate[];
}

export const PROMPT_TEMPLATE_CATEGORIES: PromptTemplateCategory[] = [
    {
        id: 'scenes',
        label: 'Scenes',
        templates: [
            {
                label: 'Golden-hour park',
                mode: 'replace',
                text: 'Wide shot of a child flying a red kite in a grassy park, golden hour sunlight casting long shadows, gentle breeze moving the grass, camera slowly pans upward following the kite into a glowing sky.'
            },
            {
                label: 'Neon city rain',
                mode: 'replace',
                text: 'Medium tracking shot of a woman in a transparent umbrella walking through a neon-lit street at night, heavy rain, reflections shimmering on wet asphalt, cinematic cyberpunk mood, shallow depth of field.'
            },
            {
                label: 'Ocean drone dive',
                mode: 'replace',
                text: 'Aerial drone shot diving from high clouds toward a turquoise ocean, a lone white sailboat cutting through waves, sunlight sparkling on the water, camera spirals down and levels out just above the surface.'
            },
            {
                label: 'Cozy café morning',
                mode: 'replace',
                text: 'Close-up of steam rising from a fresh cup of coffee on a wooden table by a rain-streaked window, soft morning light, blurred café bustle in the background, camera slowly pulls back to reveal the cozy interior.'
            },
            {
                label: 'Snowy mountain cabin',
                mode: 'replace',
                text: 'Establishing shot of a log cabin with warm glowing windows in a snow-covered pine forest at dusk, smoke curling from the chimney, snowflakes drifting, camera slowly pushes in toward the front door.'
            },
            {
                label: 'Desert caravan',
                mode: 'replace',
                text: 'Extreme wide shot of a camel caravan crossing rippled sand dunes at sunset, long shadows, heat haze on the horizon, warm orange palette, camera glides sideways parallel to the caravan.'
            },
            {
                label: 'Macro nature',
                mode: 'replace',
                text: 'Macro shot of a dewdrop rolling off a green leaf and falling in slow motion, morning backlight refracting through the drop, soft bokeh forest background, ultra shallow depth of field.'
            },
            {
                label: 'Street food wok',
                mode: 'replace',
                text: 'Close-up of a chef tossing noodles in a flaming wok at a night market stall, sparks and steam rising, lanterns glowing in the bokeh background, energetic handheld camera, appetizing warm tones.'
            }
        ]
    },
    {
        id: 'camera',
        label: 'Camera',
        templates: [
            { label: 'Slow push-in', mode: 'append', text: 'camera slowly pushes in toward the subject' },
            { label: 'Pull back reveal', mode: 'append', text: 'camera pulls back to reveal the full scene' },
            { label: 'Orbit', mode: 'append', text: 'camera orbits smoothly around the subject' },
            { label: 'Crane up', mode: 'append', text: 'camera cranes up from ground level to a high angle' },
            { label: 'Tracking shot', mode: 'append', text: 'smooth tracking shot following the subject' },
            { label: 'Handheld', mode: 'append', text: 'energetic handheld camera with slight shake' },
            { label: 'Dolly zoom', mode: 'append', text: 'dolly zoom, background warping while the subject stays fixed' },
            { label: 'FPV fly-through', mode: 'append', text: 'fast FPV drone fly-through' },
            { label: 'Low angle', mode: 'append', text: 'dramatic low-angle shot looking up' },
            { label: 'Top-down', mode: 'append', text: "top-down bird's-eye view" }
        ]
    },
    {
        id: 'style',
        label: 'Style & Light',
        templates: [
            { label: 'Cinematic', mode: 'append', text: 'cinematic film look, anamorphic lens, film grain' },
            { label: 'Golden hour', mode: 'append', text: 'golden hour sunlight, long soft shadows' },
            { label: 'Blue hour', mode: 'append', text: 'blue hour twilight, cool ambient tones' },
            { label: 'Neon noir', mode: 'append', text: 'neon noir lighting, high contrast, wet reflections' },
            { label: 'Soft daylight', mode: 'append', text: 'soft overcast daylight, natural colors' },
            { label: 'Backlit silhouette', mode: 'append', text: 'strong backlight, subject in silhouette, lens flare' },
            { label: 'Anime', mode: 'append', text: 'Japanese anime style, vibrant cel shading' },
            { label: '3D cartoon', mode: 'append', text: 'stylized 3D cartoon render, soft global illumination' },
            { label: 'Documentary', mode: 'append', text: 'naturalistic documentary look, unobtrusive camera' },
            { label: 'Slow motion', mode: 'append', text: 'dramatic slow motion' }
        ]
    }
];

/** Applies a template to the current prompt text. */
export function applyPromptTemplate(current: string, template: PromptTemplate): string {
    if (template.mode === 'replace' || !current.trim()) {
        return template.text;
    }
    const base = current.trim().replace(/[,，.。]\s*$/, '');
    return `${base}, ${template.text}`;
}
