'use client';

import { Button } from '@/components/ui/button';
import { useXcityKey } from '@/hooks/use-xcity-key';
import { resolvePortraitResult } from '@/lib/portrait';
import { Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

type CallbackState =
    | { status: 'loading' }
    | { status: 'verified'; groupId: string }
    | { status: 'failed'; message: string };

function queryValue(params: URLSearchParams, ...names: string[]): string {
    for (const name of names) {
        const value = params.get(name)?.trim();
        if (value) return value;
    }
    return '';
}

export default function PortraitCallbackPage() {
    const { resolveKey } = useXcityKey();
    const [state, setState] = React.useState<CallbackState>({ status: 'loading' });

    React.useEffect(() => {
        let cancelled = false;
        void (async () => {
            const params = new URLSearchParams(window.location.search);
            const resultCode = queryValue(params, 'resultCode', 'ResultCode', 'result_code');
            const bytedToken = queryValue(params, 'bytedToken', 'BytedToken', 'byted_token');

            if (resultCode !== '10000') {
                setState({ status: 'failed', message: 'Verification did not complete. Try again from Assets.' });
                return;
            }
            if (!bytedToken) {
                setState({ status: 'failed', message: 'Verification returned no token. Try again from Assets.' });
                return;
            }

            try {
                const key = await resolveKey();
                if (!key) {
                    throw new Error('Sign in at xcity.ai or set an API key, then try again.');
                }
                const result = await resolvePortraitResult(bytedToken, key);
                if (!cancelled) {
                    setState({ status: 'verified', groupId: result.groupId });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({
                        status: 'failed',
                        message: err instanceof Error ? err.message : 'Could not confirm verification.'
                    });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [resolveKey]);

    return (
        <main className='flex min-h-[calc(100vh-8rem)] items-center justify-center bg-black p-6 text-white'>
            <div className='w-full max-w-md rounded-lg border border-white/10 bg-white/[0.03] p-5'>
                {state.status === 'loading' ? (
                    <div className='flex items-center gap-3 text-white/70'>
                        <Loader2 className='h-5 w-5 animate-spin' />
                        Checking verification…
                    </div>
                ) : state.status === 'verified' ? (
                    <div className='space-y-4'>
                        <div className='flex items-center gap-2 text-lg font-medium text-white'>
                            <ShieldCheck className='h-5 w-5 text-emerald-300' />
                            Verified ✓
                        </div>
                        <p className='text-sm text-white/70'>
                            Return to the studio and add photos of this person.
                        </p>
                        <p className='font-mono text-xs text-white/35'>{state.groupId}</p>
                        <Button asChild className='bg-white text-black hover:bg-white/90'>
                            <Link href='/'>Return to studio</Link>
                        </Button>
                    </div>
                ) : (
                    <div className='space-y-4'>
                        <div className='text-lg font-medium text-white'>Verification failed</div>
                        <p className='text-sm text-red-300'>{state.message}</p>
                        <p className='text-sm text-white/55'>Try again from Assets → Verified people.</p>
                        <Button asChild className='bg-white text-black hover:bg-white/90'>
                            <Link href='/'>Return to studio</Link>
                        </Button>
                    </div>
                )}
            </div>
        </main>
    );
}
