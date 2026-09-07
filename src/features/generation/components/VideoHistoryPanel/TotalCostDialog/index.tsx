'use client';

import { Button } from '@/components/ui/Button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/Dialog';
import { useTranslations } from 'next-intl';

type TotalCostDialogProps = {
    open: boolean;
    totalCost: number;
    totalVideos: number;
    successfulVideos: number;
    failedVideos: number;
    billedVideos: number;
    onOpenChange: (open: boolean) => void;
};

export function TotalCostDialog({
    open,
    totalCost,
    totalVideos,
    successfulVideos,
    failedVideos,
    billedVideos,
    onOpenChange
}: TotalCostDialogProps) {
    const t = useTranslations();
    const averageCost = billedVideos > 0 ? totalCost / billedVideos : 0;
    const summary =
        failedVideos > 0
            ? t('Total billed <usd><lcur>amount<rcur> for <lcur>count<rcur> videos<comma> <lcur>failed<rcur> failed', {
                  amount: totalCost.toFixed(2),
                  count: totalVideos,
                  failed: failedVideos
              })
            : t('Total billed <usd><lcur>amount<rcur> for <lcur>count<rcur> videos', {
                  amount: totalCost.toFixed(2),
                  count: totalVideos
              });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <button
                    className='mt-0.5 flex items-center gap-1 rounded-full bg-green-600/80 px-1.5 py-0.5 text-[12px] text-white transition-colors hover:bg-green-500/90'
                    aria-label={t('Show total cost summary')}>
                    {t('Total Billed<colon> <usd><lcur>amount<rcur>', { amount: totalCost.toFixed(2) })}
                </button>
            </DialogTrigger>
            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>{t('Total Cost Summary')}</DialogTitle>
                    <DialogDescription className='sr-only'>
                        {t('A summary of the total billed cost for all generated videos in the history')}
                    </DialogDescription>
                </DialogHeader>
                <div className='rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white'>
                    {summary}
                </div>
                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                    <p>{t('Seedance billing is token<dash>based and charged only after successful completion')}</p>
                    <p>{t('Reference video estimates are lower bounds because provider floors may apply')}</p>
                </div>
                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                    <div className='flex justify-between'>
                        <span>{t('Total Videos Generated<colon>')}</span>
                        <span>{totalVideos.toLocaleString()}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span>{t('Successful Videos<colon>')}</span>
                        <span>{successfulVideos.toLocaleString()}</span>
                    </div>
                    {failedVideos > 0 && (
                        <div className='flex justify-between'>
                            <span>{t('Failed Videos<colon>')}</span>
                            <span>{failedVideos.toLocaleString()}</span>
                        </div>
                    )}
                    <div className='flex justify-between'>
                        <span>{t('Average Cost Per Video<colon>')}</span>
                        <span>${averageCost.toFixed(2)}</span>
                    </div>
                    <hr className='my-2 border-neutral-700' />
                    <div className='flex justify-between font-medium text-white'>
                        <span>{t('Total Billed Cost<colon>')}</span>
                        <span>${totalCost.toFixed(2)}</span>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            type='button'
                            variant='secondary'
                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                            {t('Close')}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
