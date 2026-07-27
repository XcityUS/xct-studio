'use client';

import * as React from 'react';

/**
 * Xcity site footer. Mirrors xct-home's column layout and legal links, trimmed
 * to the sections that make sense from a tool page (no regional/company
 * marketing columns).
 */

const COLUMNS: Array<{ title: string; links: Array<{ name: string; href: string }> }> = [
    {
        title: 'Platform',
        links: [
            { name: 'AI Platform', href: 'https://xcity.ai/ai-platform' },
            { name: 'Models', href: 'https://xcity.ai/models' },
            { name: 'Agents', href: 'https://xcity.ai/agents' },
            { name: 'Pricing', href: 'https://xcity.ai/pricing' }
        ]
    },
    {
        title: 'Products',
        links: [
            { name: 'Video Studio', href: 'https://studio.xcity.ai' },
            { name: 'Xcity Chat', href: 'https://chat.xcity.ai' },
            { name: 'Dashboard', href: 'https://xcity.ai/dashboard' },
            { name: 'API Keys', href: 'https://xcity.ai/dashboard/keys' }
        ]
    },
    {
        title: 'Legal',
        links: [
            { name: 'Terms', href: 'https://xcity.ai/terms' },
            { name: 'Privacy', href: 'https://xcity.ai/privacy' },
            { name: 'Acceptable Use', href: 'https://xcity.ai/acceptable-use' },
            { name: 'Refund Policy', href: 'https://xcity.ai/refund-policy' }
        ]
    }
];

export function SiteFooter() {
    // Rendered client-side only to keep the year from being frozen into the
    // prerendered HTML at build time.
    const [year, setYear] = React.useState<number | null>(null);
    React.useEffect(() => setYear(new Date().getFullYear()), []);

    return (
        <footer className='mt-12 w-full border-t border-white/10 bg-black'>
            <div className='mx-auto w-full max-w-7xl px-4 py-10 md:px-6'>
                <div className='grid grid-cols-2 gap-8 sm:grid-cols-3'>
                    {COLUMNS.map((col) => (
                        <div key={col.title}>
                            <h5 className='mb-3 text-xs font-semibold uppercase tracking-wider text-white/50'>
                                {col.title}
                            </h5>
                            <ul className='space-y-2'>
                                {col.links.map((link) => (
                                    <li key={link.name}>
                                        <a
                                            href={link.href}
                                            rel='noopener'
                                            className='text-sm text-white/70 transition-colors hover:text-[#635bff]'>
                                            {link.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className='mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between'>
                    <p>© {year ?? ''} Xcity. All rights reserved.</p>
                    <p>
                        Video generation powered by ByteDance Seedance via{' '}
                        <a
                            href='https://xcity.ai/models'
                            rel='noopener'
                            className='text-white/60 transition-colors hover:text-[#635bff]'>
                            Xcity TokenHub
                        </a>
                        .
                    </p>
                </div>
            </div>
        </footer>
    );
}
