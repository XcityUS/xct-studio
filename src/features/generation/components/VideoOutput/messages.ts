'use client';

import { useTranslations } from 'next-intl';

export function useOutputMessages() {
    const t = useTranslations();

    // Compatibility for the existing sanitizer. New server APIs should send stable error codes.
    function error(message: string | null): string | null {
        if (!message) return null;
        const budget =
            /^The API key budget has been exceeded\. Current cost: (\d+(?:\.\d+)?), max budget: (\d+(?:\.\d+)?)\.$/.exec(
                message
            );
        if (budget)
            return t(
                'The API key budget has been exceeded<dot> Current cost<colon> <lcur>currentCost<rcur><comma> max budget<colon> <lcur>maxBudget<rcur>',
                { currentCost: budget[1], maxBudget: budget[2] }
            );
        const dimensions =
            /^Reference image must be at least 300 px wide and 300 px tall\. This image is (\d+) x (\d+) px\.$/.exec(
                message
            );
        if (dimensions)
            return t(
                'Reference image must be at least 300 px wide and 300 px tall<dot> This image is <lcur>width<rcur> x <lcur>height<rcur> px',
                { width: dimensions[1], height: dimensions[2] }
            );
        switch (message) {
            case 'The API key budget has been exceeded.':
                return t('The API key budget has been exceeded');
            case 'Reference image must be between 300 and 6000 px on each side.':
                return t('Reference image must be between 300 and 6000 px on each side');
            case 'This reference video task requires adaptive ratio and source duration. Please retry from the Studio reference-video action.':
                return t(
                    'This reference video task requires adaptive ratio and source duration<dot> Please retry from the Studio reference<dash>video action'
                );
            case 'The generated video may contain copyrighted characters or content. Use original reference media and try again.':
                return t(
                    'The generated video may contain copyrighted characters or content<dot> Use original reference media and try again'
                );
            case 'Studio could not load the reference video. The link may have expired or the archived copy may not be ready yet.':
                return t(
                    'Studio could not load the reference video<dot> The link may have expired or the archived copy may not be ready yet'
                );
            case 'Studio could not use the reference image. Please check the image size, format, and content, then try again.':
                return t(
                    'Studio could not use the reference image<dot> Please check the image size<comma> format<comma> and content<comma> then try again'
                );
            case 'Studio could not complete this request. Please check the input settings and try again.':
                return t('Studio could not complete this request<dot> Please check the input settings and try again');
            case 'Finalize is only available for Seedance 2.5 drafts.':
                return t('Finalize is only available for Seedance 2<dot>5 drafts');
            default:
                return message;
        }
    }

    return { error };
}
