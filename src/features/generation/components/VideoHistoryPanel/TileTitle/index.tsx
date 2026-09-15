'use client';

import { useDisplayedPrompt } from '@/features/generation/use-display-prompt';
import { Check, Copy, PencilLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

/**
 * History tile title: title is display-only, while copy still grabs the full
 * prompt users need for reuse outside the studio.
 */
export function TileTitle({
    prompt,
    sourcePrompt,
    title,
    onTitleChange
}: {
    prompt: string;
    sourcePrompt?: string;
    title?: string;
    onTitleChange?: (title: string) => void;
}) {
    const t = useTranslations();
    const displayedPrompt = useDisplayedPrompt(prompt, sourcePrompt);
    const displayTitle = title?.trim() || displayedPrompt;
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
            await navigator.clipboard.writeText(displayedPrompt);
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
                    className='min-w-0 flex-1 rounded border border-[var(--studio-media-border)] bg-[var(--studio-media-overlay)] px-1 py-0.5 text-xs text-[var(--studio-media-foreground)] outline-none focus:border-[var(--studio-media-foreground)]'
                    maxLength={120}
                    aria-label={t('History title')}
                />
            ) : (
                <p
                    className='line-clamp-2 flex-1 text-xs leading-4 font-medium break-words text-white/75'
                    title={displayedPrompt}>
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
