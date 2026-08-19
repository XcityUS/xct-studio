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
