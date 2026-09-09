'use client';

import { assetReferenceLabel } from '../utils';
import { isAssetReferenceUrl } from '@/features/assets/reference/origin';
import { cn } from '@/shared/utils/classnames';
import { ImageOff, ShieldCheck } from 'lucide-react';
import * as React from 'react';

type ReferencePreviewProps = {
    url: string;
    previewUrl?: string;
    alt: string;
    className: string;
};

export function ReferencePreview({ url, previewUrl, alt, className }: ReferencePreviewProps) {
    const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
    const imageUrl = previewUrl || (!isAssetReferenceUrl(url) ? url : '');
    const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

    return (
        <div className={cn('shrink-0 overflow-hidden rounded-md border border-white/20 bg-white/5', className)}>
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary worker/external URL
                <img
                    src={imageUrl}
                    alt={alt}
                    title={url}
                    className='h-full w-full object-cover'
                    onError={() => setFailedUrl(imageUrl)}
                />
            ) : isAssetReferenceUrl(url) ? (
                <div
                    title={url}
                    className='flex h-full w-full flex-col items-center justify-center gap-1 bg-emerald-400/[0.06] px-1 text-center'>
                    <ShieldCheck className='h-4 w-4 text-emerald-300' />
                    <span className='max-w-full truncate font-mono text-[9px] text-emerald-100/80'>
                        {assetReferenceLabel(url)}
                    </span>
                </div>
            ) : (
                <ImageOff className='m-auto h-full w-4 text-white/35' aria-hidden='true' />
            )}
        </div>
    );
}
