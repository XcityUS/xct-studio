'use client';

import { AuthorizationDocButton } from '../AuthorizationDocButton';
import { formatDate, shortReferenceKey } from '../utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AuthorizationQueueItem, AuthorizationReviewAction } from '@/features/assets/authorization/api';
import { Check, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export function AuthorizationQueueCard({
    item,
    reviewingId,
    reviewNote,
    onReviewNoteChange,
    onReview,
    fetchAuthorizationDoc
}: {
    item: AuthorizationQueueItem;
    reviewingId: string | null;
    reviewNote: string;
    onReviewNoteChange: (id: string, note: string) => void;
    onReview: (item: AuthorizationQueueItem, action: AuthorizationReviewAction) => void;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
}) {
    const t = useTranslations();
    const locale = useLocale();
    const approving = reviewingId === `${item.id}:approve`;
    const rejecting = reviewingId === `${item.id}:reject`;

    return (
        <div className='space-y-3 rounded-md border border-white/15 bg-white/[0.04] p-3'>
            <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='truncate text-sm font-medium text-white' title={item.subject_name}>
                        {item.subject_name}
                    </div>
                    <div className='mt-0.5 truncate text-[10px] text-white/35'>{item.owner}</div>
                </div>
                <span className='shrink-0 text-[10px] text-white/35'>{formatDate(item.created_at, locale)}</span>
            </div>
            <div className='font-mono text-[10px] text-white/35' title={item.reference_key}>
                {shortReferenceKey(item.reference_key)}
            </div>
            {item.note && <p className='line-clamp-3 text-xs leading-5 text-white/55'>{item.note}</p>}
            <AuthorizationDocButton item={item} fetchAuthorizationDoc={fetchAuthorizationDoc} />
            <Input
                value={reviewNote}
                onChange={(event) => onReviewNoteChange(item.id, event.target.value)}
                placeholder={t('Review note')}
                disabled={Boolean(reviewingId)}
                className='h-8 rounded-md border border-white/20 bg-black text-xs text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
            />
            <div className='flex items-center justify-end gap-1.5'>
                <Button
                    type='button'
                    size='sm'
                    disabled={Boolean(reviewingId)}
                    onClick={() => onReview(item, 'approve')}
                    className='h-7 bg-white px-2 text-xs text-black hover:bg-white/90'>
                    {approving ? <Loader2 className='h-3 w-3 animate-spin' /> : <Check className='h-3 w-3' />}
                    {t('Approve')}
                </Button>
                <Button
                    type='button'
                    size='sm'
                    disabled={Boolean(reviewingId)}
                    onClick={() => onReview(item, 'reject')}
                    className='h-7 bg-red-600/70 px-2 text-xs text-[var(--studio-status-foreground)] hover:bg-red-500/80'>
                    {rejecting ? <Loader2 className='h-3 w-3 animate-spin' /> : <X className='h-3 w-3' />}
                    {t('Reject')}
                </Button>
            </div>
        </div>
    );
}
