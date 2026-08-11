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
