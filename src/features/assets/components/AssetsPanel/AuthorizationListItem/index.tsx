'use client';

import { AuthorizationDocButton } from '../AuthorizationDocButton';
import { AuthorizationStatusBadge } from '../AuthorizationStatusBadge';
import { formatDate, shortReferenceKey } from '../utils';
import type { AuthorizationItem } from '@/features/assets/authorization/api';
import { useLocale, useTranslations } from 'next-intl';

export function AuthorizationListItem({
    item,
    fetchAuthorizationDoc
}: {
    item: AuthorizationItem;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
}) {
    const t = useTranslations();
    const locale = useLocale();
    const submittedAt = formatDate(item.created_at, locale) || '-';
    const reviewedAt = item.reviewed_at ? formatDate(item.reviewed_at, locale) : '';

    return (
        <div className='flex min-h-44 flex-col rounded-md border border-white/10 bg-black/35 p-3'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 space-y-1'>
                    <div className='truncate text-sm font-medium text-white' title={item.subject_name}>
                        {item.subject_name || t('Untitled subject')}
                    </div>
                    <div
                        className='inline-flex max-w-full rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/40'
                        title={item.reference_key}>
                        <span className='truncate'>{shortReferenceKey(item.reference_key)}</span>
                    </div>
                </div>
                <AuthorizationStatusBadge status={item.status} />
            </div>
            <p
                className={`mt-3 min-h-14 rounded-md px-2 py-1.5 text-xs leading-5 ${
                    item.note ? 'bg-white/[0.04] text-white/55' : 'border border-dashed border-white/10 text-white/25'
                }`}>
                <span className='line-clamp-2'>{item.note || t('No note')}</span>
            </p>
            <div className='mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-3'>
                <div className='space-y-0.5 text-[10px] text-white/35'>
                    <div>{t('Submitted <lcur>date<rcur>', { date: submittedAt })}</div>
                    <div className={reviewedAt ? undefined : 'text-transparent'}>
                        {t('Reviewed <lcur>date<rcur>', { date: reviewedAt || '-' })}
                    </div>
                </div>
                <AuthorizationDocButton item={item} fetchAuthorizationDoc={fetchAuthorizationDoc} />
            </div>
            {item.review_note && (
                <p className='rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-white/50'>
                    {t('Review note<colon> <lcur>note<rcur>', { note: item.review_note })}
                </p>
            )}
        </div>
    );
}
