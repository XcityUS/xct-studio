'use client';

import Image from 'next/image';
import * as React from 'react';

/**
 * Xcity site header, matched to xct-home's Nav (logo + wordmark on the left,
 * links right, purple hover). Deliberately lighter than the marketing nav —
 * no dropdowns, locale switch or search — since this is a single-purpose tool
 * reached from an already-authenticated session.
 */

const LINKS: Array<{ label: string; href: string; external?: boolean }> = [
    { label: 'Dashboard', href: 'https://xcity.ai/dashboard', external: true },
    { label: 'Models', href: 'https://xcity.ai/models', external: true },
    { label: 'Chat', href: 'https://chat.xcity.ai', external: true },
    { label: 'Docs', href: 'https://xcity.ai/docs', external: true }
];

export function SiteHeader() {
    return (
        <header className='w-full border-b border-white/10 bg-black'>
            <div className='mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6'>
                <a
                    href='https://xcity.ai'
                    className='flex items-center gap-2 text-white transition-opacity hover:opacity-80'>
                    <Image src='/logo.png' alt='Xcity' width={26} height={27} priority />
                    <span className='text-base font-semibold tracking-tight'>Xcity</span>
                    <span className='hidden text-sm text-white/40 sm:inline'>/</span>
                    <span className='hidden text-sm text-white/70 sm:inline'>Video Studio</span>
                </a>

                <nav className='flex items-center gap-1 sm:gap-4'>
                    {LINKS.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            {...(link.external ? { rel: 'noopener' } : {})}
                            className='hidden px-2 py-1 text-sm text-white/70 transition-colors hover:text-[#635bff] sm:inline-block'>
                            {link.label}
                        </a>
                    ))}
                    <a
                        href='https://xcity.ai/dashboard'
                        rel='noopener'
                        className='rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-white/90'>
                        My Account
                    </a>
                </nav>
            </div>
        </header>
    );
}
