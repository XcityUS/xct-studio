'use client';

import { declarationSatisfied, type ReferenceDeclaration } from '@/features/assets/reference/origin';
import { cn } from '@/shared/utils/classnames';
import { AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ReferenceStatusBadge({
    declaration,
    approvedAuthorizationIds,
    onEdit
}: {
    declaration: ReferenceDeclaration | undefined;
    approvedAuthorizationIds: ReadonlySet<string>;
    onEdit?: () => void;
}) {
    const t = useTranslations();
    const satisfied = declarationSatisfied(declaration, approvedAuthorizationIds);
    const title = declaration
        ? satisfied
            ? t('Declaration complete<dot> Click to change origin')
            : t('Needs setup before submit<dot> Click to change origin')
        : t('Choose origin');
    const content = satisfied ? (
        <Check className='h-3 w-3' />
    ) : declaration ? (
        <AlertTriangle className='h-3 w-3' />
    ) : (
        '?'
    );
    const className = cn(
        'absolute right-0 bottom-0 flex h-4 w-4 items-center justify-center rounded-tl border border-black/50 text-[10px] font-semibold',
        satisfied ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'
    );
    if (onEdit && declaration) {
        return (
            <button
                type='button'
                title={title}
                onClick={(event) => {
                    event.stopPropagation();
                    onEdit();
                }}
                className={cn(className, 'transition-opacity hover:opacity-85')}
                aria-label={t('Change reference origin')}>
                {content}
            </button>
        );
    }
    return (
        <span title={title} className={className}>
            {content}
        </span>
    );
}
