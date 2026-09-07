'use client';

import { DEFAULT_WATERMARK_TEXT, MAX_WATERMARK_TEXT_LENGTH } from '../constants';
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
import { useTranslations } from 'next-intl';

type WatermarkDialogProps = {
    open: boolean;
    useCustomWatermark: boolean;
    customWatermarkText: string;
    onOpenChange: (open: boolean) => void;
    onUseCustomWatermarkChange: (enabled: boolean) => void;
    onCustomWatermarkTextChange: (text: string) => void;
    onConfirm: () => void;
};

export function WatermarkDialog({
    open,
    useCustomWatermark,
    customWatermarkText,
    onOpenChange,
    onUseCustomWatermarkChange,
    onCustomWatermarkTextChange,
    onConfirm
}: WatermarkDialogProps) {
    const t = useTranslations();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[420px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>{t('Add Watermark')}</DialogTitle>
                    <DialogDescription className='text-neutral-400'>
                        {t('Add a visible Studio mark to the bottom<dash>right of this video')}
                    </DialogDescription>
                </DialogHeader>
                <div className='space-y-3'>
                    <label className='flex items-center gap-2 text-sm text-white/80'>
                        <input
                            type='checkbox'
                            checked={useCustomWatermark}
                            onChange={(event) => onUseCustomWatermarkChange(event.target.checked)}
                            className='h-4 w-4 rounded border-white/30 bg-black'
                        />
                        {t('Custom text')}
                    </label>
                    {useCustomWatermark ? (
                        <div className='space-y-1'>
                            <Input
                                value={customWatermarkText}
                                maxLength={MAX_WATERMARK_TEXT_LENGTH}
                                onChange={(event) => onCustomWatermarkTextChange(event.target.value)}
                                placeholder={DEFAULT_WATERMARK_TEXT}
                                className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                            />
                            <div className='text-[10px] text-white/35'>
                                {customWatermarkText.length}/{MAX_WATERMARK_TEXT_LENGTH}
                            </div>
                        </div>
                    ) : (
                        <div className='space-y-1 rounded-md border border-white/10 bg-white/5 px-3 py-2'>
                            <div className='text-[10px] tracking-wide text-white/35 uppercase'>{t('Default')}</div>
                            <div className='text-sm text-white/70'>{DEFAULT_WATERMARK_TEXT}</div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                            {t('Cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        type='button'
                        size='sm'
                        onClick={onConfirm}
                        disabled={useCustomWatermark && customWatermarkText.trim().length === 0}
                        className='bg-white text-black hover:bg-white/90'>
                        {t('Add mark')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
