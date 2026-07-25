'use client';

import { Lock } from 'lucide-react';
import * as React from 'react';

interface ApiKeyGateProps {
    isBlocked: boolean;
    onConfigure: () => void;
    children: React.ReactNode;
}

interface ApiKeyGateProps {
    isBlocked: boolean;
    onConfigure: () => void;
    children: React.ReactNode;
    className?: string;
}

export function ApiKeyGate({ isBlocked, onConfigure, children, className }: ApiKeyGateProps) {
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!contentRef.current) {
            return;
        }
        if (isBlocked) {
            contentRef.current.setAttribute('inert', '');
        } else {
            contentRef.current.removeAttribute('inert');
        }
    }, [isBlocked]);

    return (
        <div className={`relative flex h-full w-full ${className ?? ''}`}>
            <div
                ref={contentRef}
                aria-hidden={isBlocked || undefined}
                className={isBlocked ? 'pointer-events-none flex h-full w-full flex-1' : 'flex h-full w-full flex-1'}>
                {children}
            </div>
            {isBlocked && (
                <div
                    className='absolute inset-0 z-10 flex cursor-pointer items-center justify-center backdrop-blur-sm transition-all hover:backdrop-blur-md'
                    onClick={onConfigure}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onConfigure();
                        }
                    }}>
                    <div className='flex flex-col items-center gap-4 rounded-lg border border-white/20 bg-black/80 p-8 text-center shadow-2xl'>
                        <Lock className='h-12 w-12 text-white/80' />
                        <div>
                            <h3 className='text-lg font-semibold text-white'>Configure Xcity API Key</h3>
                            <p className='mt-2 text-sm text-white/60'>Click here to get started</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
