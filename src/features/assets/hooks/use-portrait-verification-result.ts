import {
    PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY,
    readPortraitVerificationResult,
    subscribePortraitVerificationResult,
    type PortraitVerificationResult
} from '@/features/assets/portrait/setup-flow';
import * as React from 'react';

export function usePortraitVerificationResult(
    enabled: boolean,
    onResult: (result: PortraitVerificationResult) => void
) {
    React.useEffect(() => {
        if (!enabled) return;
        const receive = (notifiedResult?: PortraitVerificationResult) => {
            const result = notifiedResult ?? readPortraitVerificationResult();
            if (result) onResult(result);
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key === PORTRAIT_VERIFICATION_RESULT_STORAGE_KEY) receive();
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') receive();
        };
        const handleFocus = () => receive();
        const unsubscribe = subscribePortraitVerificationResult(receive);
        receive();
        window.addEventListener('storage', handleStorage);
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            unsubscribe();
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [enabled, onResult]);
}
