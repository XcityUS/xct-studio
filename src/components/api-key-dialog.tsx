'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { XCITY_BILLING_URL, shouldShowBillingAction } from '@/lib/billing';
import { CreditCard } from 'lucide-react';
import * as React from 'react';

interface ApiKeyDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (apiKey: string) => Promise<void> | void;
}

export function ApiKeyDialog({ isOpen, onOpenChange, onSave }: ApiKeyDialogProps) {
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
            setSaveError(error instanceof Error ? error.message : 'Failed to save API key.');
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
            <DialogContent className='border-white/20 bg-black text-white sm:max-w-[425px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>Configure Xcity API Key</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        Enter your Xcity TokenHub API key (from xcity.ai → Dashboard → Keys). The key is stored only in this browser and never sent to our servers.
                    </DialogDescription>
                </DialogHeader>
                <div className='grid gap-4 py-4'>
                    <div className='grid grid-cols-1 items-center gap-4'>
                        <Input
                            ref={inputRef}
                            id='api-key-input'
                            type='password'
                            placeholder='sk-...'
                            value={currentApiKey}
                            onChange={(e) => setCurrentApiKey(e.target.value)}
                            className='col-span-1 border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
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
                        <div
                            role='alert'
                            className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200'>
                            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                <span className='min-w-0 break-words'>{saveError}</span>
                                {showBillingAction && (
                                    <Button
                                        asChild
                                        size='sm'
                                        className='w-full bg-white text-black hover:bg-white/90 sm:w-auto'>
                                        <a href={XCITY_BILLING_URL}>
                                            <CreditCard className='h-4 w-4' />
                                            Billing
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
                        className='bg-white px-6 text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isSaving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
