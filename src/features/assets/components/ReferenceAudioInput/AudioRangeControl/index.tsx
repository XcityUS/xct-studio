'use client';

import styles from './index.module.scss';
import {
    audioTimelineSeconds,
    clampAudioRange,
    MIN_AUDIO_RANGE_SECONDS,
    moveAudioRange,
    type AudioRange
} from '@/features/generation/reference-audio/range';
import * as Slider from '@radix-ui/react-slider';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    url: string;
    maxSeconds: number;
    range: AudioRange;
    onRangeChange: (range: AudioRange) => void;
    disabled?: boolean;
};

function timeLabel(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function AudioRangeControl({ url, maxSeconds, range, onRangeChange, disabled }: Props) {
    const t = useTranslations();
    const [duration, setDuration] = React.useState<number | null>(null);
    const timeline = audioTimelineSeconds(duration);
    const selection = clampAudioRange(range, maxSeconds, timeline);
    const canSelect = duration === null || duration >= MIN_AUDIO_RANGE_SECONDS;

    const updateDuration = (seconds: number) => {
        if (!Number.isFinite(seconds) || seconds <= 0) {
            setDuration(null);
            return;
        }
        setDuration(seconds);
        const next = clampAudioRange(range, maxSeconds, audioTimelineSeconds(seconds));
        if (range.startSeconds !== next.startSeconds || range.endSeconds !== next.endSeconds) onRangeChange(next);
    };

    const handleSliderChange = (values: number[]) => {
        const [nextStart, nextEnd] = values;
        if (nextStart === undefined || nextEnd === undefined) return;
        const thumb = nextStart !== selection.startSeconds ? 'start' : 'end';
        onRangeChange(moveAudioRange(selection, thumb, thumb === 'start' ? nextStart : nextEnd, maxSeconds, timeline));
    };

    const updateStart = (value: number) => {
        onRangeChange(moveAudioRange(selection, 'start', value, maxSeconds, timeline));
    };
    const updateEnd = (value: number) => {
        onRangeChange(moveAudioRange(selection, 'end', value, maxSeconds, timeline));
    };

    return (
        <div className={styles.root}>
            <audio
                src={url}
                controls
                preload='metadata'
                className={styles.player}
                onLoadedMetadata={(event) => updateDuration(event.currentTarget.duration)}
                onDurationChange={(event) => updateDuration(event.currentTarget.duration)}
                onError={() => setDuration(null)}
                title={url}
            />
            <div className={styles.rangeHeader}>
                <span>{t('Audio excerpt')}</span>
                <span>
                    {timeLabel(selection.startSeconds)}–{timeLabel(selection.endSeconds)} / {timeLabel(timeline)}
                </span>
            </div>
            <Slider.Root
                className={styles.slider}
                value={[selection.startSeconds, selection.endSeconds]}
                min={0}
                max={Math.max(MIN_AUDIO_RANGE_SECONDS, timeline)}
                step={1}
                minStepsBetweenThumbs={MIN_AUDIO_RANGE_SECONDS}
                onValueChange={handleSliderChange}
                disabled={disabled || !canSelect}>
                <Slider.Track className={styles.track}>
                    <Slider.Range className={styles.selected} />
                </Slider.Track>
                <Slider.Thumb className={styles.thumb} aria-label={t('Audio start time')} />
                <Slider.Thumb className={styles.thumb} aria-label={t('Audio end time')} />
            </Slider.Root>
            <div className={styles.fields}>
                <label>
                    {t('Start <lpar>seconds<rpar>')}
                    <input
                        type='number'
                        min={0}
                        max={Math.max(0, timeline - MIN_AUDIO_RANGE_SECONDS)}
                        step={1}
                        value={selection.startSeconds}
                        onChange={(event) => updateStart(Number(event.target.value))}
                        disabled={disabled || !canSelect}
                    />
                </label>
                <label>
                    {t('End <lpar>seconds<rpar>')}
                    <input
                        type='number'
                        min={MIN_AUDIO_RANGE_SECONDS}
                        max={timeline}
                        step={1}
                        value={selection.endSeconds}
                        onChange={(event) => updateEnd(Number(event.target.value))}
                        disabled={disabled || !canSelect}
                    />
                </label>
            </div>
            <p className={styles.hint}>
                {duration === null
                    ? t(
                          'Audio duration unavailable<dot> Select within 0 to 600 seconds<semi> the excerpt will be checked before generation'
                      )
                    : !canSelect
                      ? t('Reference audio must be at least 2 seconds long')
                      : t('Selected audio excerpt cannot exceed <lcur>seconds<rcur> seconds', { seconds: maxSeconds })}
            </p>
        </div>
    );
}
