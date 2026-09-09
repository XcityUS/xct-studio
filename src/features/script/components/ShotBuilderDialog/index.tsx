'use client';

import { InlineError } from './InlineError';
import { ScriptImportField } from './ScriptImportField';
import { type ShotLanguageMode, ShotLanguageModeField } from './ShotLanguageModeField';
import { appendImageToken, compilePrompt, createEmptyShot, isPresetCamera } from './helpers';
import { Button } from '@/components/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { PROMPT_TEMPLATE_CATEGORIES } from '@/features/script/prompt/templates';
import { usePromptTemplateLabels } from '@/features/script/prompt/use-template-labels';
import type { ShotDraft } from '@/features/script/types';
import { InvalidApiKeyError } from '@/shared/errors';
import { cn } from '@/shared/utils/classnames';
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type ShotBuilderDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    referenceCount: number;
    referenceLabels?: (string | null)[];
    onApply: (prompt: string) => void;
    onGenerateShots?: (
        shots: ShotDraft[],
        globalNote: string,
        options: { useFormLanguageSettings: boolean }
    ) => Promise<void>;
    onBreakdownScript?: (script: string) => Promise<ShotDraft[]>;
    defaultDurationSeconds: number;
    minDurationSeconds: number;
    maxDurationSeconds: number;
    isGeneratingShots?: boolean;
    pendingShotCount?: number;
    onContinueShotQueue?: () => Promise<void>;
};

const CAMERA_TEMPLATES = PROMPT_TEMPLATE_CATEGORIES.find((category) => category.id === 'camera')?.templates ?? [];
const NO_CAMERA_VALUE = '__no_camera__';

export function ShotBuilderDialog({
    isOpen,
    onOpenChange,
    referenceCount,
    referenceLabels,
    onApply,
    onGenerateShots,
    onBreakdownScript,
    defaultDurationSeconds,
    minDurationSeconds,
    maxDurationSeconds,
    isGeneratingShots = false,
    pendingShotCount = 0,
    onContinueShotQueue
}: ShotBuilderDialogProps) {
    const t = useTranslations();
    const templateLabel = usePromptTemplateLabels();
    const [shots, setShots] = React.useState<ShotDraft[]>([createEmptyShot(defaultDurationSeconds)]);
    const [globalNote, setGlobalNote] = React.useState('');
    const [isAutoOpen, setIsAutoOpen] = React.useState(false);
    const [script, setScript] = React.useState('');
    const [isBreakingDown, setIsBreakingDown] = React.useState(false);
    const [breakdownError, setBreakdownError] = React.useState<string | null>(null);
    const [shotLanguageMode, setShotLanguageMode] = React.useState<ShotLanguageMode>('silent');

    const compiledPrompt = React.useMemo(() => compilePrompt(globalNote, shots), [globalNote, shots]);

    const updateShot = (index: number, patch: Partial<ShotDraft>) => {
        setShots((current) => current.map((shot, i) => (i === index ? { ...shot, ...patch } : shot)));
    };

    const addShot = () => {
        setShots((current) => [...current, createEmptyShot(defaultDurationSeconds)]);
    };

    const removeShot = (index: number) => {
        setShots((current) => {
            if (current.length === 1) {
                return current;
            }
            return current.filter((_, i) => i !== index);
        });
    };

    const moveShot = (index: number, direction: -1 | 1) => {
        setShots((current) => {
            const target = index + direction;
            if (target < 0 || target >= current.length) {
                return current;
            }
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const handleBreakdown = async () => {
        if (!onBreakdownScript || !script.trim() || isBreakingDown) return;

        setIsBreakingDown(true);
        setBreakdownError(null);
        try {
            const nextShots = await onBreakdownScript(script);
            setShots(
                nextShots.length
                    ? nextShots.map((shot) => ({ ...shot, durationSeconds: shot.durationSeconds ?? defaultDurationSeconds }))
                    : [createEmptyShot(defaultDurationSeconds)]
            );
        } catch (error) {
            setBreakdownError(
                error instanceof InvalidApiKeyError
                    ? t('Your Xcity API key is invalid or expired<dot> Configure a new key and retry')
                    : error instanceof Error
                      ? error.message
                      : t('Script breakdown failed')
            );
        } finally {
            setIsBreakingDown(false);
        }
    };

    const updateDuration = (index: number, value: string) => {
        const parsed = Math.round(Number(value));
        const durationSeconds = Number.isFinite(parsed)
            ? Math.min(maxDurationSeconds, Math.max(minDurationSeconds, parsed))
            : defaultDurationSeconds;
        updateShot(index, { durationSeconds });
    };

    const handleGenerateShots = async () => {
        if (!onGenerateShots || isGeneratingShots) return;
        setBreakdownError(null);
        try {
            await onGenerateShots(shots, globalNote, { useFormLanguageSettings: shotLanguageMode === 'form' });
            onOpenChange(false);
        } catch (error) {
            setBreakdownError(error instanceof Error ? error.message : t('Script breakdown failed'));
        }
    };

    const handleContinueShotQueue = async () => {
        if (!onContinueShotQueue || isGeneratingShots) return;
        setBreakdownError(null);
        try {
            await onContinueShotQueue();
            onOpenChange(false);
        } catch (error) {
            setBreakdownError(error instanceof Error ? error.message : t('Script breakdown failed'));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[86vh] overflow-y-auto border-white/20 bg-black text-white sm:max-w-[760px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>{t('Shot Builder')}</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        {t(
                            'Compose numbered Seedance shots with camera moves<comma> audio cues<comma> and reference image citations'
                        )}
                    </DialogDescription>
                </DialogHeader>

                {onBreakdownScript && (
                    <div className='rounded-md border border-white/10 bg-white/[0.03]'>
                        <button
                            type='button'
                            onClick={() => setIsAutoOpen((open) => !open)}
                            className='flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5'
                            aria-expanded={isAutoOpen}>
                            <span className='flex items-center gap-2'>
                                <Wand2 className='h-4 w-4 text-white/50' />
                                {t('Auto breakdown from script')}
                            </span>
                            <ChevronDown
                                className={cn('h-4 w-4 text-white/50 transition-transform', isAutoOpen && 'rotate-180')}
                            />
                        </button>
                        {isAutoOpen && (
                            <div className='space-y-3 border-t border-white/10 p-3'>
                                <Textarea
                                    value={script}
                                    onChange={(event) => setScript(event.target.value)}
                                    placeholder={t('Paste a short script or scene outline')}
                                    className='min-h-[100px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                />
                                <ScriptImportField
                                    disabled={isBreakingDown}
                                    value={script}
                                    onChange={setScript}
                                    onError={setBreakdownError}
                                />
                                <div className='flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center'>
                                    <Button
                                        type='button'
                                        size='sm'
                                        onClick={() => void handleBreakdown()}
                                        disabled={isBreakingDown || !script.trim()}
                                        className='bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                                        {isBreakingDown ? (
                                            <Loader2 className='h-4 w-4 animate-spin' />
                                        ) : (
                                            <Wand2 className='h-4 w-4' />
                                        )}
                                        {isBreakingDown ? t('Breaking down<hellip>') : t('Break into shots')}
                                    </Button>
                                </div>
                                {breakdownError && <InlineError>{breakdownError}</InlineError>}
                            </div>
                        )}
                    </div>
                )}

                <div className='space-y-2'>
                    <Label htmlFor='shot-global-note' className='text-white/80'>
                        {t('Global style <slash> continuity')}
                    </Label>
                    <Textarea
                        id='shot-global-note'
                        value={globalNote}
                        onChange={(event) => setGlobalNote(event.target.value)}
                        placeholder={t(
                            'e<dot>g<dot><comma> Consistent warm dusk lighting<comma> same character wardrobe across all shots'
                        )}
                        className='min-h-[72px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                    />
                </div>

                <ShotLanguageModeField value={shotLanguageMode} onChange={setShotLanguageMode} />

                <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                        <Label className='text-white/80'>{t('Shots')}</Label>
                        <Button
                            type='button'
                            size='sm'
                            onClick={addShot}
                            className='bg-white/10 text-white hover:bg-white/20'>
                            <Plus className='h-4 w-4' />
                            {t('Add shot')}
                        </Button>
                    </div>

                    <div className='space-y-3'>
                        {shots.map((shot, index) => {
                            const customCamera =
                                shot.camera?.trim() && !isPresetCamera(shot.camera.trim(), CAMERA_TEMPLATES);

                            return (
                                <div key={index} className='rounded-md border border-white/10 bg-white/[0.03] p-3'>
                                    <div className='mb-3 flex items-center justify-between gap-3'>
                                        <p className='text-sm font-medium text-white'>
                                            {t('Shot <lcur>number<rcur>', { number: index + 1 })}
                                        </p>
                                        <div className='flex items-center gap-1'>
                                            <button
                                                type='button'
                                                onClick={() => moveShot(index, -1)}
                                                disabled={index === 0}
                                                title={t('Move shot up')}
                                                aria-label={t('Move shot <lcur>number<rcur> up', { number: index + 1 })}
                                                className='rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'>
                                                <ArrowUp className='h-4 w-4' />
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => moveShot(index, 1)}
                                                disabled={index === shots.length - 1}
                                                title={t('Move shot down')}
                                                aria-label={t('Move shot <lcur>number<rcur> down', {
                                                    number: index + 1
                                                })}
                                                className='rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'>
                                                <ArrowDown className='h-4 w-4' />
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => removeShot(index)}
                                                disabled={shots.length === 1}
                                                title={t('Remove shot')}
                                                aria-label={t('Remove shot <lcur>number<rcur>', { number: index + 1 })}
                                                className='rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'>
                                                <Trash2 className='h-4 w-4' />
                                            </button>
                                        </div>
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='space-y-2'>
                                            <Label htmlFor={`shot-description-${index}`} className='text-white/70'>
                                                {t('Description')}
                                            </Label>
                                            <Textarea
                                                id={`shot-description-${index}`}
                                                value={shot.description}
                                                onChange={(event) =>
                                                    updateShot(index, { description: event.target.value })
                                                }
                                                placeholder={t(
                                                    'Medium tracking shot<colon> subject action<comma> setting<comma> lighting'
                                                )}
                                                className='min-h-[88px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                            />
                                        </div>

                                        {referenceCount > 0 && (
                                            <div className='flex flex-wrap items-center gap-1.5'>
                                                <span className='text-xs text-white/40'>
                                                    {t('Insert reference<colon>')}
                                                </span>
                                                {Array.from({ length: referenceCount }, (_, i) => i + 1).map((n) => {
                                                    const label = referenceLabels?.[n - 1]?.trim();
                                                    return (
                                                        <button
                                                            key={n}
                                                            type='button'
                                                            title={
                                                                label
                                                                    ? t(
                                                                          'Image <lcur>number<rcur><colon> <lcur>label<rcur>',
                                                                          {
                                                                              number: n,
                                                                              label
                                                                          }
                                                                      )
                                                                    : t('Image <lcur>number<rcur>', { number: n })
                                                            }
                                                            onClick={() =>
                                                                updateShot(index, {
                                                                    description: appendImageToken(shot.description, n)
                                                                })
                                                            }
                                                            className='inline-flex max-w-full items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white'>
                                                            <span className='shrink-0'>[Image {n}]</span>
                                                            {label && (
                                                                <span className='max-w-24 truncate text-white/45'>
                                                                    {label}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                                            <div className='space-y-2'>
                                                <Label htmlFor={`shot-duration-${index}`} className='text-white/70'>
                                                    {t('Duration')}
                                                </Label>
                                                <Input
                                                    id={`shot-duration-${index}`}
                                                    type='number'
                                                    min={minDurationSeconds}
                                                    max={maxDurationSeconds}
                                                    value={shot.durationSeconds ?? defaultDurationSeconds}
                                                    onChange={(event) => updateDuration(index, event.target.value)}
                                                    className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label htmlFor={`shot-camera-${index}`} className='text-white/70'>
                                                    {t('Camera')}
                                                </Label>
                                                <Select
                                                    value={shot.camera?.trim() || NO_CAMERA_VALUE}
                                                    onValueChange={(value) =>
                                                        updateShot(index, {
                                                            camera: value === NO_CAMERA_VALUE ? undefined : value
                                                        })
                                                    }>
                                                    <SelectTrigger
                                                        id={`shot-camera-${index}`}
                                                        className='w-full rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className='border-white/20 bg-black text-white'>
                                                        <SelectItem
                                                            value={NO_CAMERA_VALUE}
                                                            className='focus:bg-white/10 focus:text-white'>
                                                            {t('None')}
                                                        </SelectItem>
                                                        {customCamera && (
                                                            <SelectItem
                                                                value={shot.camera?.trim() ?? ''}
                                                                className='focus:bg-white/10 focus:text-white'>
                                                                {shot.camera}
                                                            </SelectItem>
                                                        )}
                                                        {CAMERA_TEMPLATES.map((template) => (
                                                            <SelectItem
                                                                key={template.label}
                                                                value={template.text}
                                                                className='focus:bg-white/10 focus:text-white'>
                                                                {templateLabel(template.label)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className='space-y-2'>
                                                <Label htmlFor={`shot-audio-${index}`} className='text-white/70'>
                                                    {t('Audio cue')}
                                                </Label>
                                                <Input
                                                    id={`shot-audio-${index}`}
                                                    value={shot.audio ?? ''}
                                                    onChange={(event) =>
                                                        updateShot(index, { audio: event.target.value })
                                                    }
                                                    placeholder={t('spoken line or BGM description')}
                                                    className='rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter className='border-t border-white/10 pt-4'>
                    <Button
                        type='button'
                        variant='secondary'
                        onClick={() => onOpenChange(false)}
                        className='bg-white/10 text-white hover:bg-white/20'>
                        {t('Cancel')}
                    </Button>
                    <Button
                        type='button'
                        onClick={() => onApply(compiledPrompt)}
                        disabled={!compiledPrompt.trim()}
                        className='bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                        {t('Apply to prompt')}
                    </Button>
                    {onGenerateShots && (
                        <Button
                            type='button'
                            onClick={() => void handleGenerateShots()}
                            disabled={isGeneratingShots || !compiledPrompt.trim()}
                            className='bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                            {isGeneratingShots && <Loader2 className='h-4 w-4 animate-spin' />}
                            {isGeneratingShots ? t('Generating shots<hellip>') : t('Generate each shot')}
                        </Button>
                    )}
                    {onContinueShotQueue && pendingShotCount > 0 && (
                        <Button
                            type='button'
                            onClick={() => void handleContinueShotQueue()}
                            disabled={isGeneratingShots}
                            className='bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                            {isGeneratingShots && <Loader2 className='h-4 w-4 animate-spin' />}
                            {t('Continue queue <lpar><lcur>count<rcur><rpar>', { count: pendingShotCount })}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
