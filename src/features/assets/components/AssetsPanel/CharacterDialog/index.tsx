'use client';

import styles from './index.module.scss';
import { Button } from '@/components/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';

type CharacterDialogProps = {
    name: string;
    open: boolean;
    onNameChange: (name: string) => void;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CharacterDialog({ name, open, onNameChange, onOpenChange, onSubmit }: CharacterDialogProps) {
    const t = useTranslations();
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={styles.dialog}>
                <form onSubmit={onSubmit} className={styles.form}>
                    <DialogHeader>
                        <DialogTitle>{t('Save as character')}</DialogTitle>
                        <DialogDescription>{t('Name this image for reuse in video prompts')}</DialogDescription>
                    </DialogHeader>
                    <div className={styles.field}>
                        <Label htmlFor='character-name'>{t('Name')}</Label>
                        <Input
                            id='character-name'
                            value={name}
                            onChange={(event) => onNameChange(event.target.value)}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button type='button' variant='secondary' onClick={() => onOpenChange(false)}>
                            {t('Cancel')}
                        </Button>
                        <Button type='submit' disabled={!name.trim()}>
                            {t('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
