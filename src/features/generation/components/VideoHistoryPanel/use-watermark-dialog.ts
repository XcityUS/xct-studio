import { MAX_WATERMARK_TEXT_LENGTH } from './constants';
import type { VideoHistoryPanelProps } from './types';
import type { VideoMetadata } from '@/shared/contracts/video';
import * as React from 'react';

export function useWatermarkDialog(onAddWatermark: VideoHistoryPanelProps['onAddWatermark']) {
    const [watermarkDialogItem, setWatermarkDialogItem] = React.useState<VideoMetadata | null>(null);
    const [useCustomWatermark, setUseCustomWatermark] = React.useState(false);
    const [customWatermarkText, setCustomWatermarkText] = React.useState('');

    const openWatermarkDialog = React.useCallback((item: VideoMetadata) => {
        setWatermarkDialogItem(item);
        setUseCustomWatermark(false);
        setCustomWatermarkText('');
    }, []);
    const handleWatermarkDialogOpenChange = React.useCallback((open: boolean) => {
        if (!open) {
            setWatermarkDialogItem(null);
            setUseCustomWatermark(false);
            setCustomWatermarkText('');
        }
    }, []);
    const handleConfirmAddWatermark = React.useCallback(() => {
        if (!watermarkDialogItem) return;
        const text = useCustomWatermark ? customWatermarkText.trim().slice(0, MAX_WATERMARK_TEXT_LENGTH) : undefined;
        void onAddWatermark?.(watermarkDialogItem, text || undefined);
        handleWatermarkDialogOpenChange(false);
    }, [customWatermarkText, handleWatermarkDialogOpenChange, onAddWatermark, useCustomWatermark, watermarkDialogItem]);

    return {
        watermarkDialogItem,
        useCustomWatermark,
        setUseCustomWatermark,
        customWatermarkText,
        setCustomWatermarkText,
        openWatermarkDialog,
        handleWatermarkDialogOpenChange,
        handleConfirmAddWatermark
    };
}
