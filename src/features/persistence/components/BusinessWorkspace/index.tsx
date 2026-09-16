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
import { WorkspaceStartup } from '../WorkspaceStartup';
import { ApiKeyDialog } from '@/features/settings/components/ApiKeyDialog';
import { useLocalApiKeyOption } from '@/features/settings/hooks/use-local-api-key-option';
import { useXcityKeyState } from '@/features/settings/hooks/use-xcity-key';
import { XcityKeyContext } from '@/features/settings/key-context';
import { useLoginHref } from '@/features/settings/hooks/use-login-href';
import { PersistenceError } from '../../api';
import { clearRememberedDrafts } from '@/features/script/components/ShotBuilderDialog/draft';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

export function BusinessWorkspace({ children }: { children: ReactNode }) {
    const auth = useXcityKeyState();
    const loginHref = useLoginHref();
    const allowManualApiKey = useLocalApiKeyOption();
    const { apiKey, keyRef, resolveKey, invalidateKey } = auth;
    const checkingAuth = auth.ssoStatus === 'checking';
    const sync = useSyncExternalStore(subscribeBusiness, businessStatus, businessStatus);
    const [dialog, setDialog] = useState(false);
    const [generation, setGeneration] = useState(0);
    const [now, setNow] = useState(0);
    const [recoveryNotice, setRecoveryNotice] = useState(false);
    const recoveringConflict = useRef(false);
    const t = useTranslations();
    const ready = businessSessionMatches(auth.apiKey);
    const elapsed = sync.startedAt ? Math.max(0, Math.floor((now - sync.startedAt) / 1000)) : 0;
    const stageLabel = sync.stage === 'validation' ? t('Validating local cached records')
        : sync.stage === 'import' ? t('Importing records missing from database')
        : sync.stage === 'legacy' ? t('Synchronizing previous cloud history')
        : sync.stage === 'media' ? t('Preparing local media cache')
        : t('Reading database records');
    const mediaPending = ready && businessRecords().some((r) => r.table === 'media_assets' && r.data?.archivePending);
    const showStartup = Boolean(apiKey && !ready && !sync.error);
    const showStatus = !ready || Boolean(sync.error) || sync.pending > 0 || sync.invalid > 0 || mediaPending || recoveryNotice;
    const autoRetry = ready && sync.pending > 0 && (
        sync.error === 'DATABASE_BUSY' || sync.error === 'DATABASE_TIMEOUT' || sync.error === 'DATABASE_UNAVAILABLE'
    );
    const statusState = sync.error && !autoRetry ? 'error' : sync.invalid > 0 || recoveryNotice ? 'notice' : 'working';
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

    const recoverConflict = useCallback(() => {
        if (recoveringConflict.current) return;
        recoveringConflict.current = true;
        void loadDatabaseVersion()
            .then(() => {
                clearRememberedDrafts(sync.owner);
                setGeneration((value) => value + 1);
                setRecoveryNotice(true);
            })
            .catch(() => undefined)
            .finally(() => { recoveringConflict.current = false; });
    }, [sync.owner]);

    useEffect(() => {
        if (sync.error === 'DATA_CONFLICT' && ready) recoverConflict();
    }, [ready, sync.error, recoverConflict]);

    useEffect(() => {
        if (!recoveryNotice) return;
        const timer = window.setTimeout(() => setRecoveryNotice(false), 8000);
        return () => window.clearTimeout(timer);
    }, [recoveryNotice]);

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
            {showStartup ? (
                <WorkspaceStartup
                    stage={sync.stage}
                    stageLabel={stageLabel}
                    progress={sync.progress}
                    migrating={sync.migrating}
                    elapsed={elapsed}
                    processed={sync.processed}
                    total={sync.total}
                />
            ) : showStatus && <div className={styles.status} data-mode={ready ? 'floating' : 'gate'} data-state={statusState} data-sync-error={sync.error ?? undefined} data-pending-count={sync.pending} role={statusState === 'error' ? 'alert' : 'status'}>
                <span className={styles.indicator} aria-hidden="true" />
                {!auth.apiKey ? (
                    <>
                        <span>{t('Sign in to load your projects')}</span>
                        <a href={loginHref}>{t('Sign in')}</a>
                        {allowManualApiKey && (
                            <button onClick={() => setDialog(true)}>{t('Configure Xcity API Key')}</button>
                        )}
                    </>
                ) : autoRetry ? (
                    <span>{t('Sync is queued<dot> Retrying automatically<comma> local changes are safe')} ({sync.pending})</span>
                ) : sync.error === 'LOCAL_BACKUP_FAILED' ? (
                    <span>{t('Keep this tab open<dot> Local backup could not be saved')}</span>
                ) : sync.error ? (
                    <span>{t('Changes are not synced<dot> Your local backup is preserved')}</span>
                ) : sync.pending ? (
                    <span>{t('Saving <lcur>count<rcur> records', { count: sync.pending })}</span>
                ) : recoveryNotice ? (
                    <span>{t('Latest version loaded<dot> Unsynced edits were saved locally')}</span>
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
                    allowManualApiKey
                        ? <button onClick={() => setDialog(true)}>{t('Configure Xcity API Key')}</button>
                        : <a href={loginHref}>{t('Sign in')}</a>
                )}
                {sync.error === 'LOCAL_BACKUP_FAILED' && ready && <button onClick={recoverConflict}>{t('Retry')}</button>}
                {sync.error && sync.error !== 'DATA_CONFLICT' && sync.error !== 'LOCAL_BACKUP_FAILED' && !autoRetry && <button onClick={retry}>{t('Retry')}</button>}
            </div>}
            {ready && <div key={`${sync.owner}:${generation}`}>{children}</div>}
            {allowManualApiKey && (
                <ApiKeyDialog isOpen={dialog} onOpenChange={setDialog} onSave={auth.saveManualKey} />
            )}
        </XcityKeyContext.Provider>
    );
}
