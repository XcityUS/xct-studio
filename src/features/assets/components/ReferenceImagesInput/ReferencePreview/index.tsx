'use client';

import { assetReferenceLabel } from '../utils';
import { isAssetReferenceUrl } from '@/features/assets/reference/origin';
import { cn } from '@/shared/utils/classnames';
import { ShieldCheck } from 'lucide-react';

export function ReferencePreview({ url, alt, className }: { url: string; alt: string; className: string }) {
    return (
        <div className={cn('shrink-0 overflow-hidden rounded-md border border-white/20 bg-white/5', className)}>
            {isAssetReferenceUrl(url) ? (
                <div
                    title={url}
                    className='flex h-full w-full flex-col items-center justify-center gap-1 bg-emerald-400/[0.06] px-1 text-center'>
                    <ShieldCheck className='h-4 w-4 text-emerald-300' />
                    <span className='max-w-full truncate font-mono text-[9px] text-emerald-100/80'>
                        {assetReferenceLabel(url)}
                    </span>
                </div>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary worker/external URL
                <img
                    src={url}
                    alt={alt}
                    title={url}
                    className='h-full w-full object-cover'
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.visibility = 'hidden';
                    }}
                />
            )}
        </div>
    );
}
