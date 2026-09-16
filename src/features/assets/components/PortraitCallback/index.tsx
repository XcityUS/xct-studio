'use client';

import styles from './index.module.scss';
import { resolvePortraitResult } from '@/features/assets/portrait/api';
import { writePortraitVerificationResult } from '@/features/assets/portrait/setup-flow';
import { useXcityKeyState } from '@/features/settings/hooks/use-xcity-key';
import { Link } from '@/i18n/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type CallbackState =
    | { status: 'loading' }
    | { status: 'verified'; groupId: string }
    | {
          status: 'failed';
          reason: 'incomplete' | 'missingToken' | 'signInRequired' | 'confirmFailed';
          message?: string;
      };

function queryValue(params: URLSearchParams, ...names: string[]): string {
    for (const name of names) {
        const value = params.get(name)?.trim();
        if (value) return value;
    }
    return '';
}

export function PortraitCallback() {
    const t = useTranslations();
    const { resolveKey } = useXcityKeyState();
    const [state, setState] = React.useState<CallbackState>({ status: 'loading' });

    React.useEffect(() => {
        let cancelled = false;
        void (async () => {
            const params = new URLSearchParams(window.location.search);
            const resultCode = queryValue(params, 'resultCode', 'ResultCode', 'result_code');
            const bytedToken = queryValue(params, 'bytedToken', 'BytedToken', 'byted_token');

            if (resultCode !== '10000') {
                setState({ status: 'failed', reason: 'incomplete' });
                return;
            }
            if (!bytedToken) {
                setState({ status: 'failed', reason: 'missingToken' });
                return;
            }

            try {
                const key = await resolveKey();
                if (!key) {
                    if (!cancelled) setState({ status: 'failed', reason: 'signInRequired' });
                    return;
                }
                const result = await resolvePortraitResult(bytedToken, key);
                if (!cancelled) {
                    writePortraitVerificationResult(result.groupId);
                    setState({ status: 'verified', groupId: result.groupId });
                    window.setTimeout(() => window.close(), 900);
                }
            } catch (err) {
                if (!cancelled) {
                    setState({
                        status: 'failed',
                        reason: 'confirmFailed',
                        message: err instanceof Error ? err.message : undefined
                    });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [resolveKey]);

    const failureMessages = {
        incomplete: t('Verification did not complete<dot> Try again from Assets'),
        missingToken: t('Verification returned no token<dot> Try again from Assets'),
        signInRequired: t('Sign in at xcity<dot>ai<comma> then try again'),
        confirmFailed: t('Could not confirm verification')
    };

    return (
        <main className={styles.page}>
            <div className={styles.panel}>
                {state.status === 'loading' ? (
                    <div className={styles.status} role='status'>
                        <Loader2 size={20} className={styles.spinner} aria-hidden='true' />
                        {t('Checking verification')}
                    </div>
                ) : state.status === 'verified' ? (
                    <div className={styles.result}>
                        <h1 className={styles.status}>
                            <ShieldCheck size={20} className={styles.success} aria-hidden='true' />
                            {t('Verified')}
                        </h1>
                        <p>{t('Return to the studio and add photos of this person')}</p>
                        <p className={styles.identifier}>{state.groupId}</p>
                        <Link href='/assets' className={styles.returnLink}>
                            {t('Return to studio')}
                        </Link>
                    </div>
                ) : (
                    <div className={styles.result}>
                        <h1>{t('Verification failed')}</h1>
                        <p className={styles.error} role='alert'>
                            {state.message || failureMessages[state.reason]}
                        </p>
                        <p>{t('Try again from Assets <rarr> Verified people')}</p>
                        <Link href='/assets' className={styles.returnLink}>
                            {t('Return to studio')}
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
