'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function CopyUrlButton({ url }: { url: string }) {
    const t = useTranslations();
    const [copied, setCopied] = React.useState(false);
    const [copyFailed, setCopyFailed] = React.useState(false);
    return (
        <button
            type='button'
            title={t('Copy URL')}
            onClick={async () => {
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(url);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = url;
                        textarea.setAttribute('readonly', '');
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        const ok = document.execCommand('copy');
                        document.body.removeChild(textarea);
                        if (!ok) throw new Error('Copy command was rejected.');
                    }
                    setCopied(true);
                    setCopyFailed(false);
                    setTimeout(() => setCopied(false), 2000);
                } catch (err) {
                    console.error('Failed to copy URL:', err);
                    setCopied(false);
                    setCopyFailed(true);
                    setTimeout(() => setCopyFailed(false), 2500);
                }
            }}
            className='inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md bg-white/10 px-2 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white'>
            {copied ? <Check size={11} className='text-green-400' /> : <Copy size={11} />}
            {copyFailed ? t('Copy failed') : copied ? t('Copied') : t('Copy URL')}
        </button>
    );
}
