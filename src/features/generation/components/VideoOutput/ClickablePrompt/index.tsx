'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { useDisplayedPrompt } from '@/features/generation/use-display-prompt';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export function ClickablePrompt({ prompt, sourcePrompt }: { prompt: string; sourcePrompt?: string }) {
    const t = useTranslations();
    const [copied, setCopied] = React.useState(false);
    const displayedPrompt = useDisplayedPrompt(prompt, sourcePrompt);

    const handleCopyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(displayedPrompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy prompt:', err);
        }
    };

    if (!displayedPrompt) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className='group cursor-pointer rounded-md bg-white/5 p-3 transition-colors hover:bg-white/10'
                    onClick={handleCopyPrompt}>
                    <div className='flex items-start justify-between gap-2'>
                        <p className='line-clamp-2 flex-1 text-xs text-white/70'>{displayedPrompt}</p>
                        <div className='shrink-0 text-white/40 transition-colors group-hover:text-white/60'>
                            {copied ? (
                                <Check className='h-3.5 w-3.5 text-green-400' />
                            ) : (
                                <Copy className='h-3.5 w-3.5' />
                            )}
                        </div>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent side='top' className='border border-white/20 bg-black text-white'>
                <p>{t('Click to copy full prompt')}</p>
            </TooltipContent>
        </Tooltip>
    );
}
