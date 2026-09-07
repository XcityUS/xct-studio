'use client';

import { Check, Copy, PencilLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

/**
 * History tile title: title is display-only, while copy still grabs the full
 * prompt users need for reuse outside the studio.
 */
export function TileTitle({
    prompt,
    title,
    onTitleChange
}: {
    prompt: string;
    title?: string;
    onTitleChange?: (title: string) => void;
}) {
    const t = useTranslations();
    const displayTitle = title?.trim() || prompt;
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(displayTitle);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (!editing) setDraft(displayTitle);
    }, [displayTitle, editing]);

    const commitTitle = () => {
        const next = draft.trim();
        setEditing(false);
        if (next !== (title?.trim() || '')) {
            onTitleChange?.(next);
        }
    };

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy prompt:', err);
        }
    };

    return (
        <div className='flex min-h-8 items-start gap-1'>
            {editing ? (
                <input
                    value={draft}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setDraft(displayTitle);
                            setEditing(false);
                        }
                    }}
                    className='min-w-0 flex-1 rounded border border-white/20 bg-black/60 px-1 py-0.5 text-xs text-white outline-none focus:border-white/50'
                    maxLength={120}
                    aria-label={t('History title')}
                />
            ) : (
                <p
                    className='line-clamp-2 flex-1 text-xs leading-4 font-medium break-words text-white/75'
                    title={prompt}>
                    {displayTitle}
                </p>
            )}
            {onTitleChange && !editing && (
                <button
                    type='button'
                    onClick={(e) => {
                        e.stopPropagation();
                        setDraft(displayTitle);
                        setEditing(true);
                    }}
                    title={t('Edit title')}
                    className='shrink-0 pt-0.5 text-white/40 transition-colors hover:text-white'>
                    <PencilLine size={12} />
                </button>
            )}
            <button
                type='button'
                onClick={handleCopy}
                title={t('Copy prompt')}
                className='shrink-0 pt-0.5 text-white/40 transition-colors hover:text-white'>
                {copied ? <Check size={12} className='text-green-400' /> : <Copy size={12} />}
            </button>
        </div>
    );
}
