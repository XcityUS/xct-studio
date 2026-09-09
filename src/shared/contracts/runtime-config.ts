export interface RuntimeConfig {
    mediaWorkerUrl: string;
    transcribeModel: string;
    ttsModel: string;
    imageModels: string[];
    portraitEnabled: boolean;
}
