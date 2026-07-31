export class InvalidApiKeyError extends Error {
    constructor(message = 'Invalid Xcity API key') {
        super(message);
        this.name = 'InvalidApiKeyError';
    }
}
