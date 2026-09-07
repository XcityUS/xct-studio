'use client';

import styles from './index.module.scss';
import { Button } from '@/components/ui/Button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { XCITY_BILLING_URL, shouldShowBillingAction } from '@/features/settings/billing';
import { CreditCard, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

interface ApiKeyDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (apiKey: string) => Promise<void> | void;
}

export function ApiKeyDialog({ isOpen, onOpenChange, onSave }: ApiKeyDialogProps) {
    const t = useTranslations();
    const [currentApiKey, setCurrentApiKey] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const showBillingAction = shouldShowBillingAction(saveError);

    const handleSave = async () => {
        if (isSaving || !currentApiKey.trim()) {
            return;
        }

        setIsSaving(true);
        setSaveError(null);

        try {
            inputRef.current?.blur();
            await Promise.resolve(onSave(currentApiKey.trim()));
            setCurrentApiKey('');
            onOpenChange(false);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : t('Failed to save API key'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            setCurrentApiKey('');
            setSaveError(null);
            setIsSaving(false);
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent className={styles.dialog} hideCloseButton>
                <DialogClose className={styles.close} aria-label={t('Close')} title={t('Close')}>
                    <X size={16} aria-hidden='true' />
                </DialogClose>
                <DialogHeader>
                    <DialogTitle>{t('Configure Xcity API Key')}</DialogTitle>
                    <DialogDescription className={styles.description}>
                        {t(
                            'Enter your Xcity TokenHub API key from xcity<dot>ai <rarr> Dashboard <rarr> Keys<dot> It is stored in this browser and used to authenticate generation and asset requests'
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className={styles.fields}>
                    <div className={styles.field}>
                        <Input
                            ref={inputRef}
                            id='api-key-input'
                            type='password'
                            aria-label={t('Xcity API key')}
                            placeholder='sk-...'
                            value={currentApiKey}
                            onChange={(e) => setCurrentApiKey(e.target.value)}
                            className={styles.input}
                            disabled={isSaving}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && currentApiKey.trim()) {
                                    e.preventDefault();
                                    void handleSave();
                                }
                            }}
                        />
                    </div>
                    {saveError && (
                        <div role='alert' className={styles.error}>
                            <div className={styles.errorContent}>
                                <span>{saveError}</span>
                                {showBillingAction && (
                                    <Button asChild size='sm' className={styles.action}>
                                        <a href={XCITY_BILLING_URL}>
                                            <CreditCard size={16} aria-hidden='true' />
                                            {t('Billing')}
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        type='button'
                        onClick={() => void handleSave()}
                        disabled={isSaving || !currentApiKey.trim()}
                        className={styles.action}>
                        {isSaving ? t('Saving') : t('Save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
