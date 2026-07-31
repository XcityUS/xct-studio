'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { PROMPT_TEMPLATE_CATEGORIES, type PromptTemplate } from '@/lib/prompt-templates';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface PromptInspirationDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called with the chosen template; the caller merges it into the prompt. */
    onPick: (template: PromptTemplate) => void;
}

/**
 * Jimeng-style 灵感 browser: full scene prompts to start from, plus camera
 * and style phrases that append to what's already written.
 */
export function PromptInspirationDialog({ isOpen, onOpenChange, onPick }: PromptInspirationDialogProps) {
    const [activeCategory, setActiveCategory] = React.useState(PROMPT_TEMPLATE_CATEGORIES[0].id);

    const category =
        PROMPT_TEMPLATE_CATEGORIES.find((c) => c.id === activeCategory) ?? PROMPT_TEMPLATE_CATEGORIES[0];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[80vh] overflow-y-auto border-white/20 bg-black text-white sm:max-w-[560px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>Prompt Inspiration</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        Scene templates replace your prompt; camera and style phrases are appended to it.
                    </DialogDescription>
                </DialogHeader>

                <div className='flex gap-2'>
                    {PROMPT_TEMPLATE_CATEGORIES.map((c) => (
                        <button
                            key={c.id}
                            type='button'
                            onClick={() => setActiveCategory(c.id)}
                            className={cn(
                                'rounded-full px-3 py-1 text-sm transition-colors',
                                c.id === activeCategory
                                    ? 'bg-white text-black'
                                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                            )}>
                            {c.label}
                        </button>
                    ))}
                </div>

                {category.id === 'scenes' ? (
                    <div className='space-y-2'>
                        {category.templates.map((t) => (
                            <button
                                key={t.label}
                                type='button'
                                onClick={() => onPick(t)}
                                className='w-full rounded-md border border-white/15 bg-white/5 p-3 text-left transition-colors hover:border-white/30 hover:bg-white/10'>
                                <p className='text-sm font-medium text-white'>{t.label}</p>
                                <p className='mt-1 line-clamp-2 text-xs text-white/50'>{t.text}</p>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className='flex flex-wrap gap-2'>
                        {category.templates.map((t) => (
                            <button
                                key={t.label}
                                type='button'
                                onClick={() => onPick(t)}
                                title={t.text}
                                className='rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white'>
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
