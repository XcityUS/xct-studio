import { useTranslations } from 'next-intl';

export function usePromptTemplateLabels() {
    const t = useTranslations();
    const labels: Record<string, string> = {
        'Golden-hour park': t('Golden<dash>hour park'),
        'Neon city rain': t('Neon city rain'),
        'Ocean drone dive': t('Ocean drone dive'),
        'Cozy café morning': t('Cozy cafe morning'),
        'Snowy mountain cabin': t('Snowy mountain cabin'),
        'Desert caravan': t('Desert caravan'),
        'Macro nature': t('Macro nature'),
        'Street food wok': t('Street food wok'),
        'Crash zoom': t('Crash zoom'),
        'Slow dolly-in': t('Slow dolly<dash>in'),
        'Orbit arc': t('Orbit arc'),
        'Whip pan': t('Whip pan'),
        'Crane rise': t('Crane rise'),
        'FPV fly-through': t('FPV fly<dash>through'),
        'Handheld doc': t('Handheld doc'),
        'Dolly zoom': t('Dolly zoom'),
        'Tracking shot': t('Tracking shot'),
        'Top-down reveal': t('Top<dash>down reveal'),
        'Earth zoom-out': t('Earth zoom<dash>out'),
        'Rack focus': t('Rack focus'),
        Snorricam: t('Snorricam'),
        'Speed ramp': t('Speed ramp'),
        'Static locked-off': t('Static locked<dash>off'),
        'Push-in close-up': t('Push<dash>in close<dash>up'),
        Cinematic: t('Cinematic'),
        'Golden hour': t('Golden hour'),
        'Blue hour': t('Blue hour'),
        'Neon noir': t('Neon noir'),
        'Soft daylight': t('Soft daylight'),
        'Backlit silhouette': t('Backlit silhouette'),
        Anime: t('Anime'),
        '3D cartoon': t('3D cartoon'),
        Documentary: t('Documentary'),
        'Slow motion': t('Slow motion')
    };
    return (label: string) => labels[label] ?? label;
}
