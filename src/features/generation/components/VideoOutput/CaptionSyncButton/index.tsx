import { Button } from '@/components/ui/Button';
import { Loader2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

type CaptionSyncButtonProps = {
    pending: boolean;
    onClick: () => void;
};

export function CaptionSyncButton({ pending, onClick }: CaptionSyncButtonProps) {
    const t = useTranslations();
    return (
        <Button
            type='button'
            onClick={onClick}
            disabled={pending}
            title={t('Align subtitles with the generated audio and save the timing to cloud')}
            variant='outline'
            className='min-w-0 flex-1 basis-36 border-white/20 bg-black text-white hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60'>
            {pending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <RotateCcw className='mr-2 h-4 w-4' />}
            {pending ? t('Syncing subtitles') : t('Sync subtitles')}
        </Button>
    );
}
