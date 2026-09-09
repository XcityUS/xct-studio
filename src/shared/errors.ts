/**
 * BytePlus refused a reference image that looks like a real person. The only
 * sanctioned way through is a consent-verified asset from the private
 * real-human library, so callers decide the guidance based on whether that
 * library is configured for this deployment.
 */
export class RealPersonImageError extends Error {
    constructor(public readonly providerMessage: string) {
        super(providerMessage);
        this.name = 'RealPersonImageError';
    }
}

export class InvalidApiKeyError extends Error {
    constructor(message = 'Invalid Xcity API key') {
        super(message);
        this.name = 'InvalidApiKeyError';
    }
}

export class StateConflictError extends Error {
    constructor(message = 'Cloud history changed on another device') {
        super(message);
        this.name = 'StateConflictError';
    }
}

export function sanitizeStudioErrorMessage(message?: string | null): string {
    if (!message) return 'Studio could not complete this request. Please check the input settings and try again.';

    if (/budget has been exceeded|api key budget has been exceeded/i.test(message)) {
        const currentCost = message.match(/current cost:\s*(\d+(?:\.\d+)?)/i)?.[1];
        const maxBudget = message.match(/max budget:\s*(\d+(?:\.\d+)?)/i)?.[1];
        if (currentCost && maxBudget) {
            return `The API key budget has been exceeded. Current cost: ${currentCost}, max budget: ${maxBudget}.`;
        }
        return 'The API key budget has been exceeded.';
    }

    const dimensions = message.match(/received a\s+(\d+)x(\d+)px image/i);
    if (dimensions) {
        return `Reference image must be at least 300 px wide and 300 px tall. This image is ${dimensions[1]} x ${dimensions[2]} px.`;
    }

    if (/height to be at least 300px|width to be at least 300px|between 300 and 6000/i.test(message)) {
        return 'Reference image must be between 300 and 6000 px on each side.';
    }

    if (/ratio.*adaptive|duration.*-1|video editing based on your prompt/i.test(message)) {
        return 'This reference video task requires adaptive ratio and source duration. Please retry from the Studio reference-video action.';
    }

    if (/OutputVideoSensitiveContentDetected|copyright restrictions/i.test(message)) {
        return 'The generated video may contain copyrighted characters or content. Use original reference media and try again.';
    }

    if (
        /reference_video.*web url|video_url.*download|resource download failed|download the draft video/i.test(message)
    ) {
        return 'Studio could not load the reference video. The link may have expired or the archived copy may not be ready yet.';
    }

    if (/image_url|input_reference|reference image|image instead|InvalidParameter/i.test(message)) {
        return 'Studio could not use the reference image. Please check the image size, format, and content, then try again.';
    }

    if (/litellm|byteplus|bytedance|model group|fallbacks|request id|provider/i.test(message)) {
        return 'Studio could not complete this request. Please check the input settings and try again.';
    }

    return message;
}
