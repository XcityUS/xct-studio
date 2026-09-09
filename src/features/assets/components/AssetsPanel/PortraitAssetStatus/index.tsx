'use client';

import type { VideoPortrait } from '@/features/generation/history/merge';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function PortraitAssetStatus({ portrait }: { portrait: VideoPortrait }) {
    const t = useTranslations();
    const activeLabel =
        portrait.referenceOrigin === 'no-person'
            ? t('Reviewed')
            : portrait.groupType === 'AIGC'
              ? t('Virtual')
              : t('Verified');
    const label =
        portrait.status === 'Active' ? activeLabel : portrait.status === 'Failed' ? t('Failed') : t('Under review');
    const Icon = portrait.groupType === 'AIGC' && portrait.referenceOrigin !== 'no-person' ? Sparkles : ShieldCheck;

    return (
        <div className='min-w-0'>
            <div className='flex items-center gap-1 text-[10px] text-white/65'>
                <Icon className='h-2.5 w-2.5' />
                {label}
            </div>
            {portrait.failureReason && (
                <div className='max-w-40 truncate text-[10px] text-red-300/80'>{portrait.failureReason}</div>
            )}
        </div>
    );
}
