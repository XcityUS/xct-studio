'use client';

import { AlertCircle } from 'lucide-react';
import * as React from 'react';

export function InlineError({ children }: { children: React.ReactNode }) {
    return (
        <div
            role='alert'
            className='flex w-full items-start gap-2 rounded-md border border-red-400/25 bg-red-500/[0.08] px-3 py-2 text-xs leading-5 text-red-200'>
            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-300' />
            <span className='min-w-0 break-words'>{children}</span>
        </div>
    );
}
