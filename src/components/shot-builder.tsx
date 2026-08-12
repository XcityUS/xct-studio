'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PROMPT_TEMPLATE_CATEGORIES } from '@/lib/prompt-templates';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import * as React from 'react';

export type ShotDraft = {
    description: string;
    camera?: string;
    audio?: string;
};

type ShotBuilderDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    referenceCount: number;
    referenceLabels?: (string | null)[];
    onApply: (prompt: string) => void;
    onBreakdownScript?: (script: string) => Promise<ShotDraft[]>;
};

const CAMERA_TEMPLATES = PROMPT_TEMPLATE_CATEGORIES.find((category) => category.id === 'camera')?.templates ?? [];
const NO_CAMERA_VALUE = '__no_camera__';

function createEmptyShot(): ShotDraft {
    return { description: '' };
}

function cleanAudioCue(audio: string): string {
    return audio
        .trim()
        .replace(/^\{+|\}+$/g, '')
        .trim();
}

function compilePrompt(globalNote: string, shots: ShotDraft[]): string {
    const lines = shots
        .map((shot) => {
            const description = shot.description.trim();
            const camera = shot.camera?.trim();
            const audio = shot.audio ? cleanAudioCue(shot.audio) : '';

            let line = description;
            if (camera) {
                line = line ? `${line}, ${camera}` : camera;
            }
            if (audio) {
                line = line ? `${line} {${audio}}` : `{${audio}}`;
            }

            return line;
        })
        .filter(Boolean)
        .map((line, index) => `${index + 1}) ${line}`);

    return [globalNote.trim(), lines.join('\n')].filter(Boolean).join('\n');
}

function appendImageToken(description: string, imageIndex: number): string {
    const token = `[Image ${imageIndex}]`;
    if (!description) {
        return token;
    }
    return `${description}${/\s$/.test(description) ? '' : ' '}${token}`;
}

function isPresetCamera(camera: string): boolean {
    return CAMERA_TEMPLATES.some((template) => template.text === camera);
}

export function ShotBuilderDialog({
    isOpen,
    onOpenChange,
    referenceCount,
    referenceLabels,
    onApply,
    onBreakdownScript
}: ShotBuilderDialogProps) {
    const [shots, setShots] = React.useState<ShotDraft[]>([createEmptyShot()]);
    const [globalNote, setGlobalNote] = React.useState('');
    const [isAutoOpen, setIsAutoOpen] = React.useState(false);
    const [script, setScript] = React.useState('');
    const [isBreakingDown, setIsBreakingDown] = React.useState(false);
    const [breakdownError, setBreakdownError] = React.useState<string | null>(null);

    const compiledPrompt = React.useMemo(() => compilePrompt(globalNote, shots), [globalNote, shots]);

    const updateShot = (index: number, patch: Partial<ShotDraft>) => {
        setShots((current) => current.map((shot, i) => (i === index ? { ...shot, ...patch } : shot)));
    };

    const addShot = () => {
        setShots((current) => [...current, createEmptyShot()]);
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
            setShots(nextShots.length ? nextShots : [createEmptyShot()]);
        } catch (error) {
            setBreakdownError(error instanceof Error ? error.message : 'Script breakdown failed.');
        } finally {
            setIsBreakingDown(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className='max-h-[86vh] overflow-y-auto border-white/20 bg-black text-white sm:max-w-[760px]'>
                <DialogHeader>
                    <DialogTitle className='text-white'>Shot Builder</DialogTitle>
                    <DialogDescription className='text-white/60'>
                        Compose numbered Seedance shots with camera moves, audio cues, and reference image citations.
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
                                Auto breakdown from script
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
                                    placeholder='Paste a short script or scene outline.'
                                    className='min-h-[100px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                />
                                <div className='flex flex-wrap items-center gap-3'>
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
                                        {isBreakingDown ? 'Breaking down...' : 'Break into shots'}
                                    </Button>
                                    {breakdownError && <p className='text-xs text-red-400'>{breakdownError}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className='space-y-2'>
                    <Label htmlFor='shot-global-note' className='text-white/80'>
                        Global style / continuity
                    </Label>
                    <Textarea
                        id='shot-global-note'
                        value={globalNote}
                        onChange={(event) => setGlobalNote(event.target.value)}
                        placeholder='e.g., Consistent warm dusk lighting, same character wardrobe across all shots.'
                        className='min-h-[72px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                    />
                </div>

                <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                        <Label className='text-white/80'>Shots</Label>
                        <Button
                            type='button'
                            size='sm'
                            onClick={addShot}
                            className='bg-white/10 text-white hover:bg-white/20'>
                            <Plus className='h-4 w-4' />
                            Add shot
                        </Button>
                    </div>

                    <div className='space-y-3'>
                        {shots.map((shot, index) => {
                            const customCamera = shot.camera?.trim() && !isPresetCamera(shot.camera.trim());

                            return (
                                <div key={index} className='rounded-md border border-white/10 bg-white/[0.03] p-3'>
                                    <div className='mb-3 flex items-center justify-between gap-3'>
                                        <p className='text-sm font-medium text-white'>Shot {index + 1}</p>
                                        <div className='flex items-center gap-1'>
                                            <button
                                                type='button'
                                                onClick={() => moveShot(index, -1)}
                                                disabled={index === 0}
                                                title='Move shot up'
                                                aria-label={`Move shot ${index + 1} up`}
                                                className='rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'>
                                                <ArrowUp className='h-4 w-4' />
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => moveShot(index, 1)}
                                                disabled={index === shots.length - 1}
                                                title='Move shot down'
                                                aria-label={`Move shot ${index + 1} down`}
                                                className='rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'>
                                                <ArrowDown className='h-4 w-4' />
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => removeShot(index)}
                                                disabled={shots.length === 1}
                                                title='Remove shot'
                                                aria-label={`Remove shot ${index + 1}`}
                                                className='rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30'>
                                                <Trash2 className='h-4 w-4' />
                                            </button>
                                        </div>
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='space-y-2'>
                                            <Label htmlFor={`shot-description-${index}`} className='text-white/70'>
                                                Description
                                            </Label>
                                            <Textarea
                                                id={`shot-description-${index}`}
                                                value={shot.description}
                                                onChange={(event) =>
                                                    updateShot(index, { description: event.target.value })
                                                }
                                                placeholder='Medium tracking shot: subject action, setting, lighting.'
                                                className='min-h-[88px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                                            />
                                        </div>

                                        {referenceCount > 0 && (
                                            <div className='flex flex-wrap items-center gap-1.5'>
                                                <span className='text-xs text-white/40'>Insert reference:</span>
                                                {Array.from({ length: referenceCount }, (_, i) => i + 1).map((n) => {
                                                    const label = referenceLabels?.[n - 1]?.trim();
                                                    return (
                                                        <button
                                                            key={n}
                                                            type='button'
                                                            title={label ? `[Image ${n}] ${label}` : `[Image ${n}]`}
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

                                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                                            <div className='space-y-2'>
                                                <Label htmlFor={`shot-camera-${index}`} className='text-white/70'>
                                                    Camera
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
                                                            None
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
                                                                {template.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className='space-y-2'>
                                                <Label htmlFor={`shot-audio-${index}`} className='text-white/70'>
                                                    Audio cue
                                                </Label>
                                                <Input
                                                    id={`shot-audio-${index}`}
                                                    value={shot.audio ?? ''}
                                                    onChange={(event) =>
                                                        updateShot(index, { audio: event.target.value })
                                                    }
                                                    placeholder='spoken line or BGM description'
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
                        Cancel
                    </Button>
                    <Button
                        type='button'
                        onClick={() => onApply(compiledPrompt)}
                        disabled={!compiledPrompt.trim()}
                        className='bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                        Apply to prompt
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
