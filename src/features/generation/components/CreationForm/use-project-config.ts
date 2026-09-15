import {
    RATIOS,
    RESOLUTIONS,
    isShortDramaModel,
    type VideoModel,
    type VideoRatio,
    type VideoResolution
} from '@/shared/config/seedance';
import type { ShortDramaProject } from '@/shared/contracts/production';
import * as React from 'react';

type Setter<Value> = React.Dispatch<React.SetStateAction<Value>>;

export function useProjectConfig(input: {
    enabled: boolean;
    project?: ShortDramaProject;
    setModel: Setter<VideoModel>;
    setRatio: Setter<VideoRatio>;
    setResolution: Setter<VideoResolution>;
    setVoiceLanguage: Setter<string>;
    setCaptionMode: Setter<string>;
    setWatermark: Setter<boolean>;
    setWatermarkText: Setter<string>;
}) {
    const {
        enabled,
        project,
        setModel,
        setRatio,
        setResolution,
        setVoiceLanguage,
        setCaptionMode,
        setWatermark,
        setWatermarkText
    } = input;
    React.useEffect(() => {
        if (!enabled || !project) return;
        if (isShortDramaModel(project.generationModel)) setModel(project.generationModel);
        if (RATIOS.some((value) => value === project.targetRatio)) setRatio(project.targetRatio as VideoRatio);
        if (RESOLUTIONS.some((value) => value === project.targetResolution)) {
            setResolution(project.targetResolution as VideoResolution);
        }
        setVoiceLanguage(project.voiceLanguage);
        setCaptionMode(
            project.subtitleMode === 'none' ? 'none' : project.sourceLanguage === 'en-US' ? 'burn-en-US' : 'burn-zh-CN'
        );
        setWatermark(project.watermark);
        setWatermarkText(project.watermarkText ?? '');
    }, [
        enabled,
        project,
        setCaptionMode,
        setModel,
        setRatio,
        setResolution,
        setVoiceLanguage,
        setWatermark,
        setWatermarkText
    ]);
}
