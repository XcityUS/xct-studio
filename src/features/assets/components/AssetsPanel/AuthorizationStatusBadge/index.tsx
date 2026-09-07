'use client';

import { authorizationStatusClass } from '../utils';
import type { AuthorizationItem } from '@/features/assets/authorization/api';
import { useTranslations } from 'next-intl';

export function AuthorizationStatusBadge({ status }: { status: AuthorizationItem['status'] }) {
    const t = useTranslations();
    const statusLabel = status === 'approved' ? t('Approved') : status === 'rejected' ? t('Rejected') : t('Pending');
    return (
        <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${authorizationStatusClass(
                status
            )}`}>
            {statusLabel}
        </span>
    );
}
