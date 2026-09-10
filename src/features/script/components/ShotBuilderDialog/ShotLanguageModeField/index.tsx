'use client';

import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useTranslations } from 'next-intl';

export type ShotLanguageMode = 'silent' | 'form';

type ShotLanguageModeFieldProps = {
    value: ShotLanguageMode;
    onChange: (value: ShotLanguageMode) => void;
};

export function ShotLanguageModeField({ value, onChange }: ShotLanguageModeFieldProps) {
    const t = useTranslations();

    return (
        <div className='space-y-2'>
            <Label htmlFor='shot-language-mode' className='text-white/80'>
                {t('Shot language <slash> subtitles')}
            </Label>
            <Select value={value} onValueChange={(nextValue) => onChange(nextValue === 'form' ? 'form' : 'silent')}>
                <SelectTrigger
                    id='shot-language-mode'
                    className='w-full rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className='border-white/20 bg-black text-white'>
                    <SelectItem value='silent' className='focus:bg-white/10 focus:text-white'>
                        {t('No generated speech or subtitles')}
                    </SelectItem>
                    <SelectItem value='form' className='focus:bg-white/10 focus:text-white'>
                        {t('Use current video language and subtitle settings')}
                    </SelectItem>
                </SelectContent>
            </Select>
            <p className='text-xs leading-5 text-white/45'>
                {t(
                    'Set this once before generating shots so the queue does not inherit an unintended default language'
                )}
            </p>
        </div>
    );
}
