'use client';

import { formatBytes } from '../utils';
import type { AuthorizationItem } from '@/features/assets/authorization/api';
import { FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function AuthorizationDocButton({
    item,
    fetchAuthorizationDoc
}: {
    item: Pick<AuthorizationItem, 'id' | 'has_doc' | 'doc_bytes' | 'doc_content_type'>;
    fetchAuthorizationDoc: (id: string) => Promise<Blob>;
}) {
    const t = useTranslations();
    const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
    const [isLoadingDoc, setIsLoadingDoc] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [objectUrl]);

    const openDoc = async () => {
        if (!item.has_doc || isLoadingDoc) return;
        setError(null);
        if (objectUrl) {
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        setIsLoadingDoc(true);
        try {
            const blob = await fetchAuthorizationDoc(item.id);
            const url = URL.createObjectURL(blob);
            setObjectUrl(url);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            setError(t('Could not open document'));
        } finally {
            setIsLoadingDoc(false);
        }
    };

    return (
        <div className='space-y-1'>
            <button
                type='button'
                onClick={() => void openDoc()}
                disabled={!item.has_doc || isLoadingDoc}
                className='inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2.5 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                {isLoadingDoc ? <Loader2 className='h-3 w-3 animate-spin' /> : <FileText className='h-3 w-3' />}
                {item.has_doc ? t('Open document') : t('No document')}
            </button>
            {item.has_doc && (
                <p className='text-[10px] text-white/35'>
                    {item.doc_content_type || t('Document')} {formatBytes(item.doc_bytes)}
                </p>
            )}
            {error && <p className='text-[10px] text-red-300'>{error}</p>}
        </div>
    );
}
