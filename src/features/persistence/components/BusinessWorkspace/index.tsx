'use client';

import {
    businessRecords,
    businessSessionMatches,
    businessStatus,
    flushBusiness,
    startBusiness,
    stopBusiness,
    subscribeBusiness,
    loadDatabaseVersion
} from '../../store';
import { useMediaPersistence } from '../../use-media-persistence';
import styles from './index.module.scss';
import { ApiKeyDialog } from '@/features/settings/components/ApiKeyDialog';
import { useXcityKeyState } from '@/features/settings/hooks/use-xcity-key';
import { XcityKeyContext } from '@/features/settings/key-context';
import { useLoginHref } from '@/features/settings/hooks/use-login-href';
import { PersistenceError } from '../../api';
import { clearRememberedDrafts } from '@/features/script/components/ShotBuilderDialog/draft';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

export function BusinessWorkspace({ children }: { children: ReactNode }) {
    const auth = useXcityKeyState();
    const loginHref = useLoginHref();
    const { apiKey, keyRef, resolveKey, invalidateKey } = auth;
    const checkingAuth = auth.ssoStatus === 'checking';
    const sync = useSyncExternalStore(subscribeBusiness, businessStatus, businessStatus);
    const [dialog, setDialog] = useState(false);
    const [generation, setGeneration] = useState(0);
    const [now, setNow] = useState(0);
    const t = useTranslations();
    const ready = businessSessionMatches(auth.apiKey);
    const elapsed = sync.startedAt ? Math.max(0, Math.floor((now - sync.startedAt) / 1000)) : 0;
    const stageLabel = sync.stage === 'validation' ? t('Validating local cached records')
        : sync.stage === 'import' ? t('Importing records missing from database')
        : sync.stage === 'legacy' ? t('Synchronizing previous cloud history')
        : sync.stage === 'media' ? t('Preparing local media cache')
        : t('Reading database records');
    const mediaPending = ready && businessRecords().some((r) => r.table === 'media_assets' && r.data?.archivePending);
    const showStatus = !ready || Boolean(sync.error) || sync.pending > 0 || sync.invalid > 0 || mediaPending;
    const autoRetry = ready && sync.pending > 0 && (
        sync.error === 'DATABASE_BUSY' || sync.error === 'DATABASE_TIMEOUT' || sync.error === 'DATABASE_UNAVAILABLE'
    );
    const statusState = sync.error && !autoRetry ? 'error' : sync.invalid > 0 ? 'notice' : 'working';
    const retry = useCallback(() => {
        if (!auth.apiKey) return;
        if (businessSessionMatches(auth.apiKey)) {
            void flushBusiness().catch(() => undefined);
            return;
        }
        void startBusiness(auth.apiKey)
            .then(() => setGeneration((v) => v + 1))
            .catch(() => undefined);
    }, [auth.apiKey]);

    useEffect(() => {
        if (ready || !apiKey || sync.error) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [ready, apiKey, sync.error]);

    useEffect(() => {
        if (!apiKey || checkingAuth) return;
        let cancelled = false;
        void startBusiness(apiKey).catch(async (error: unknown) => {
            if (cancelled || keyRef.current !== apiKey ||
                !(error instanceof PersistenceError) || error.code !== 'AUTH_REQUIRED') return;
            try {
                const refreshed = await resolveKey();
                if (cancelled || keyRef.current !== apiKey) return;
                if (!refreshed || refreshed === apiKey) invalidateKey();
            } catch {
                // Keep the actionable authentication error; never retry indefinitely.
            }
        });
        return () => {
            cancelled = true;
            stopBusiness();
        };
    }, [apiKey, checkingAuth, keyRef, resolveKey, invalidateKey]);

    useEffect(() => {
        const flush = () => {
            void flushBusiness().catch(() => undefined);
        };
        const unload = (event: BeforeUnloadEvent) => {
            if (businessStatus().pending) {
                event.preventDefault();
                event.returnValue = '';
            }
        };
        window.addEventListener('online', flush);
        window.addEventListener('beforeunload', unload);
        const timer = window.setInterval(flush, 15000);
        return () => {
            clearInterval(timer);
            window.removeEventListener('online', flush);
            window.removeEventListener('beforeunload', unload);
        };
    }, []);
    useMediaPersistence(ready ? auth.apiKey : null);

    return (
        <XcityKeyContext.Provider value={auth}>
            {showStatus && <div className={styles.status} data-state={statusState} data-sync-error={sync.error ?? undefined} data-pending-count={sync.pending} role={statusState === 'error' ? 'alert' : 'status'}>
                <span className={styles.indicator} aria-hidden="true" />
                {!auth.apiKey ? (
                    <>
                        <span>{t('Sign in to load your projects')}</span>
                        <a href={loginHref}>{t('Sign in')}</a>
                        <button onClick={() => setDialog(true)}>{t('Configure Xcity API Key')}</button>
                    </>
                ) : autoRetry ? (
                    <span>{t('Sync is queued<dot> Retrying automatically<comma> local changes are safe')} ({sync.pending})</span>
                ) : sync.error ? (
                    <span>{t('Changes are not synced<dot> Your local backup is preserved')}</span>
                ) : !ready && !sync.migrating ? (
                    <span>{t('Loading your workspace')}</span>
                ) : !ready ? (
                    <div className={styles.loading}>
                        <div className={styles.progressHeading}>
                            <span>{stageLabel}</span>
                            <span>{t('Startup progress')} {Math.floor(sync.progress)}%</span>
                        </div>
                        <progress
                            className={styles.progress}
                            max={100}
                            value={sync.progress}
                            aria-label={t('Startup progress')}
                        />
                        <span>
                            {t('Elapsed <lcur>seconds<rcur> seconds', { seconds: elapsed })}
                            {sync.stage === 'import' && sync.total > 0 && (
                                <> · {t('Imported <lcur>completed<rcur> of <lcur>total<rcur> records', {
                                    completed: sync.processed, total: sync.total
                                })}</>
                            )}
                        </span>
                        <small>{t('Progress follows startup stages<comma> not remaining time<dot> Local originals are retained')}</small>
                        {elapsed >= 30 && (
                            <small>{t('Startup is taking longer<dot> Time depends on record count and network speed')}</small>
                        )}
                    </div>
                ) : sync.pending ? (
                    <span>{t('Saving <lcur>count<rcur> records', { count: sync.pending })}</span>
                ) : (
                    <span>{t('Changes saved to database')}</span>
                )}
                {sync.invalid > 0 && <span>{t('Some cached records need attention and were kept locally')}</span>}
                {sync.error === 'DATABASE_BUSY' && !autoRetry && (
                    <span>{t('Database is processing another sync<dot> Retry shortly')}</span>
                )}
                {sync.error === 'DATABASE_TIMEOUT' && !autoRetry && (
                    <span>{t('Database request timed out<dot> Retry to continue importing missing records')}</span>
                )}
                {mediaPending && <span>{t('Media files are waiting to be archived')}</span>}
                {sync.error === 'QUEUE_ALREADY_CLAIMED' && <span>{t('This queue item was already submitted<dot> Check its generation status before retrying')}</span>}
                {sync.error === 'DATABASE_NOT_CONFIGURED' && (
                    <span>{t('Configure the server database connection')}</span>
                )}
                {sync.error === 'STABLE_IDENTITY_REQUIRED' && (
                    <span>{t('Your API key must belong to a user account')}</span>
                )}
                {sync.error === 'AUTH_REQUIRED' && (
                    <button onClick={() => setDialog(true)}>{t('Configure Xcity API Key')}</button>
                )}
                {sync.error && sync.error !== 'DATA_CONFLICT' && !autoRetry && <button onClick={retry}>{t('Retry')}</button>}
                {sync.error === 'DATA_CONFLICT' && (
                    <>
                        <span>{t('This data was changed on another device')}</span>
                        <button
                            onClick={() => {
                                clearRememberedDrafts(sync.owner);
                                void loadDatabaseVersion()
                                    .then(() => setGeneration((v) => v + 1))
                                    .catch(() => undefined);
                            }}>
                            {t('Load database version and keep local recovery copy')}
                        </button>
                    </>
                )}
            </div>
            }
            {ready && <div key={`${sync.owner}:${generation}`}>{children}</div>}
            <ApiKeyDialog isOpen={dialog} onOpenChange={setDialog} onSave={auth.saveManualKey} />
        </XcityKeyContext.Provider>
    );
}
