'use client';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { ModeToggle } from '@/components/ui/ModeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { aspectRatioFromSize, VideoPlayer } from '@/components/ui/VideoPlayer';
import { Loader2, Sparkles } from 'lucide-react';
import type { VideoModel, VideoSize } from 'openai/resources/videos';
import * as React from 'react';

export type RemixFormData = {
    source_video_id: string;
    prompt: string;
};

type RemixFormProps = {
    onSubmit: (data: RemixFormData) => void;
    isLoading: boolean;
    currentMode: 'create' | 'remix';
    onModeChange: (mode: 'create' | 'remix') => void;
    sourceVideoId: string;
    setSourceVideoId: React.Dispatch<React.SetStateAction<string>>;
    remixPrompt: string;
    setRemixPrompt: React.Dispatch<React.SetStateAction<string>>;
    completedVideos: Array<{
        id: string;
        prompt: string;
        model: VideoModel;
        size: VideoSize;
        seconds: number;
    }>;
    getVideoSrc: (id: string) => string | undefined;
};

export function RemixForm({
    onSubmit,
    isLoading,
    currentMode,
    onModeChange,
    sourceVideoId,
    setSourceVideoId,
    remixPrompt,
    setRemixPrompt,
    completedVideos,
    getVideoSrc
}: RemixFormProps) {
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!sourceVideoId) {
            alert('Please select a source video to remix.');
            return;
        }
        const formData: RemixFormData = {
            source_video_id: sourceVideoId,
            prompt: remixPrompt
        };
        onSubmit(formData);
    };

    const selectedVideo = completedVideos.find((v) => v.id === sourceVideoId);
    const videoSrc = sourceVideoId ? getVideoSrc(sourceVideoId) : undefined;

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>Remix Video</CardTitle>
                    </div>
                    <CardDescription className='mt-1 text-white/60'>
                        Make targeted changes to an existing video.
                    </CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4 lg:overflow-visible'>
                    <div className='space-y-2'>
                        <Label htmlFor='source-video-select' className='text-white'>
                            Source Video
                        </Label>
                        <Select value={sourceVideoId} onValueChange={setSourceVideoId} disabled={isLoading}>
                            <SelectTrigger
                                id='source-video-select'
                                className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                                <SelectValue placeholder='Select a completed video...' />
                            </SelectTrigger>
                            <SelectContent className='border-white/20 bg-black text-white'>
                                {completedVideos.length === 0 ? (
                                    <SelectItem value='none' disabled className='text-white/40'>
                                        No completed videos available
                                    </SelectItem>
                                ) : (
                                    completedVideos.map((video) => (
                                        <SelectItem
                                            key={video.id}
                                            value={video.id}
                                            className='focus:bg-white/10 focus:text-white'>
                                            <div className='flex flex-col'>
                                                <span className='font-medium'>
                                                    {video.prompt.length > 50
                                                        ? video.prompt.substring(0, 50) + '...'
                                                        : video.prompt}
                                                </span>
                                                <span className='text-xs text-white/40'>
                                                    {video.model} • {video.size} • {video.seconds}s
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <p className='text-xs text-white/40'>
                            Choose a video from your history to use as the base for the remix.
                        </p>
                    </div>

                    {selectedVideo && videoSrc && (
                        <div className='space-y-2'>
                            <Label className='text-white'>Source Video Preview</Label>
                            <div className='overflow-hidden rounded-lg border border-white/20'>
                                <VideoPlayer
                                    instanceKey={selectedVideo.id}
                                    src={videoSrc}
                                    aspectRatio={aspectRatioFromSize(selectedVideo.size)}
                                    className='w-full bg-black'
                                />
                            </div>
                            <div className='rounded-md bg-white/5 p-3'>
                                <p className='text-xs text-white/60'>
                                    <span className='font-medium text-white/80'>Original Prompt:</span>{' '}
                                    {selectedVideo.prompt}
                                </p>
                                <p className='mt-1 text-xs text-white/40'>
                                    {selectedVideo.model} • {selectedVideo.size} • {selectedVideo.seconds}s
                                </p>
                            </div>
                        </div>
                    )}

                    <div className='space-y-1.5'>
                        <Label htmlFor='remix-prompt' className='text-white'>
                            Remix Prompt
                        </Label>
                        <Textarea
                            id='remix-prompt'
                            placeholder='e.g., Change the color palette to teal, sand, and rust, with a warm backlight.'
                            value={remixPrompt}
                            onChange={(e) => setRemixPrompt(e.target.value)}
                            required
                            disabled={isLoading || !sourceVideoId}
                            className='min-h-[100px] resize-none rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                        <p className='text-xs text-white/40'>
                            Describe a single, well-defined change. Smaller edits preserve more of the original
                            fidelity.
                        </p>
                    </div>

                    {!sourceVideoId && completedVideos.length > 0 && (
                        <div className='rounded-md border border-white/20 bg-white/5 p-4 text-center'>
                            <p className='text-sm text-white/60'>Select a source video above to begin remixing.</p>
                        </div>
                    )}

                    {completedVideos.length === 0 && (
                        <div className='rounded-md border border-white/20 bg-white/5 p-4 text-center'>
                            <p className='text-sm text-white/60'>
                                No completed videos available yet. Create a video first, then you can remix it here.
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !remixPrompt.trim() || !sourceVideoId}
                        className='w-full bg-white text-black hover:bg-white/90 disabled:bg-white/40'>
                        {isLoading ? (
                            <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Creating Remix...
                            </>
                        ) : (
                            <>
                                <Sparkles className='mr-2 h-4 w-4' />
                                Remix Video
                            </>
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
