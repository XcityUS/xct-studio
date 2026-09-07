'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';

type ModeToggleProps = {
    currentMode: 'create' | 'remix';
    onModeChange: (mode: 'create' | 'remix') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    return (
        <Tabs
            value={currentMode}
            onValueChange={(value) => onModeChange(value as 'create' | 'remix')}
            className='w-auto'>
            <TabsList className='grid h-auto grid-cols-1 items-center justify-items-stretch gap-2 rounded-md border-none bg-transparent p-0 sm:grid-cols-2 sm:gap-2 sm:justify-items-center sm:px-0 sm:py-0 md:max-w-[18rem]'>
                <TabsTrigger
                    value='create'
                    className={`w-full rounded-md border px-3 py-1 text-sm transition-colors sm:w-full sm:px-4 sm:py-1.5 sm:text-sm ${
                        currentMode === 'create'
                            ? 'border-white bg-white text-black'
                            : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                    } `}>
                    Create Video
                </TabsTrigger>
                <TabsTrigger
                    value='remix'
                    className={`w-full rounded-md border px-3 py-1 text-sm transition-colors sm:w-full sm:px-4 sm:py-1.5 sm:text-sm ${
                        currentMode === 'remix'
                            ? 'border-white bg-white text-black'
                            : 'border-dashed border-white/30 bg-transparent text-white/60 hover:border-white/50 hover:text-white/80'
                    } `}>
                    Remix Video
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
