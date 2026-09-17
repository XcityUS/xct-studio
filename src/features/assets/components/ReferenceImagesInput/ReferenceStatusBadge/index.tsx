'use client';

import {
    declarationSatisfied,
    isAssetReferenceUrl,
    referenceSatisfied,
    type ReferenceDeclaration
} from '@/features/assets/reference/origin';
import type { VideoPortraitStatus } from '@/features/generation/history/merge';
import { cn } from '@/shared/utils/classnames';
import { AlertTriangle, Check, Clock3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ReferenceStatusBadge({
    url,
    declaration,
    approvedAuthorizationIds,
    reviewStatus
}: {
    url: string;
    declaration: ReferenceDeclaration | undefined;
    approvedAuthorizationIds: ReadonlySet<string>;
    reviewStatus?: VideoPortraitStatus;
}) {
    const t = useTranslations();
    const satisfied = referenceSatisfied(url, declaration, approvedAuthorizationIds, reviewStatus);
    const untrackedAssetId = isAssetReferenceUrl(url) && !declarationSatisfied(declaration, approvedAuthorizationIds);
    const title = satisfied
        ? untrackedAssetId
            ? t('Asset ID')
            : t('Reviewed')
        : reviewStatus === 'Processing'
          ? t('Under review')
          : reviewStatus === 'Failed'
            ? t('Review failed')
            : t('Needs review');
    const content = satisfied ? (
        <Check className='h-3 w-3' />
    ) : reviewStatus === 'Processing' ? (
        <Clock3 className='h-3 w-3' />
    ) : (
        <AlertTriangle className='h-3 w-3' />
    );
    const className = cn(
        'absolute right-0 bottom-0 flex h-4 w-4 items-center justify-center rounded-tl border border-black/50 text-[10px] font-semibold',
        satisfied ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'
    );
    return (
        <span title={title} className={className}>
            {content}
        </span>
    );
}
