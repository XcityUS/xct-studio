const TIMELINE_FPS = 24;

export type Fcp7XmlClip = {
    name: string;
    url: string;
    durationSeconds: number;
    width: number;
    height: number;
    fps?: number;
    inSeconds?: number;
    outSeconds?: number;
};

function escapeXml(value: string) {
    return value.replace(/[<>&'"]/g, (char) => {
        switch (char) {
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '&':
                return '&amp;';
            case "'":
                return '&apos;';
            case '"':
                return '&quot;';
            default:
                return char;
        }
    });
}

function secondsToFrames(seconds: number) {
    if (!Number.isFinite(seconds)) return 0;
    return Math.max(0, Math.round(seconds * TIMELINE_FPS));
}

function clampFrame(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizedDimension(value: number) {
    if (!Number.isFinite(value)) return 2;
    return Math.max(2, Math.round(value));
}

function rateXml(indent: string) {
    return [
        `${indent}<rate>`,
        `${indent}    <timebase>${TIMELINE_FPS}</timebase>`,
        `${indent}    <ntsc>FALSE</ntsc>`,
        `${indent}</rate>`
    ].join('\n');
}

function sampleCharacteristicsXml(indent: string, width: number, height: number) {
    return [
        `${indent}<samplecharacteristics>`,
        rateXml(`${indent}    `),
        `${indent}    <width>${normalizedDimension(width)}</width>`,
        `${indent}    <height>${normalizedDimension(height)}</height>`,
        `${indent}    <anamorphic>FALSE</anamorphic>`,
        `${indent}    <pixelaspectratio>square</pixelaspectratio>`,
        `${indent}    <fielddominance>none</fielddominance>`,
        `${indent}</samplecharacteristics>`
    ].join('\n');
}

function clipTiming(clip: Fcp7XmlClip) {
    const sourceDurationFrames = Math.max(1, secondsToFrames(clip.durationSeconds));
    const inFrame = clampFrame(secondsToFrames(clip.inSeconds ?? 0), 0, sourceDurationFrames - 1);
    const requestedOut = secondsToFrames(clip.outSeconds ?? clip.durationSeconds);
    const outFrame = clampFrame(requestedOut, inFrame + 1, sourceDurationFrames);

    return {
        sourceDurationFrames,
        inFrame,
        outFrame,
        timelineDurationFrames: outFrame - inFrame
    };
}

export function buildFcp7Xml(clips: Fcp7XmlClip[]): string {
    const sequenceWidth = clips[0] ? normalizedDimension(clips[0].width) : 1920;
    const sequenceHeight = clips[0] ? normalizedDimension(clips[0].height) : 1080;
    const timelineClips = clips.map((clip) => ({ clip, timing: clipTiming(clip) }));
    const totalFrames = timelineClips.reduce((total, { timing }) => total + timing.timelineDurationFrames, 0);
    let cursor = 0;

    const clipItems = timelineClips.map(({ clip, timing }, index) => {
        const start = cursor;
        const end = start + timing.timelineDurationFrames;
        cursor = end;

        const name = escapeXml(clip.name.trim() || `Clip ${index + 1}`);
        const url = escapeXml(clip.url);
        const fileId = `file-${index + 1}`;
        const clipItemId = `clipitem-${index + 1}`;

        return [
            `                <clipitem id="${clipItemId}">`,
            `                    <name>${name}</name>`,
            `                    <duration>${timing.sourceDurationFrames}</duration>`,
            rateXml('                    '),
            `                    <start>${start}</start>`,
            `                    <end>${end}</end>`,
            `                    <enabled>TRUE</enabled>`,
            `                    <in>${timing.inFrame}</in>`,
            `                    <out>${timing.outFrame}</out>`,
            `                    <file id="${fileId}">`,
            `                        <name>${name}</name>`,
            `                        <pathurl>${url}</pathurl>`,
            `                        <duration>${timing.sourceDurationFrames}</duration>`,
            rateXml('                        '),
            `                        <media>`,
            `                            <video>`,
            sampleCharacteristicsXml('                                ', clip.width, clip.height),
            `                            </video>`,
            `                        </media>`,
            `                    </file>`,
            `                </clipitem>`
        ].join('\n');
    });

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE xmeml>',
        '<xmeml version="4">',
        '    <sequence id="sequence-1">',
        '        <name>Xcity Timeline</name>',
        `        <duration>${totalFrames}</duration>`,
        rateXml('        '),
        '        <timecode>',
        rateXml('            '),
        '            <string>00:00:00:00</string>',
        '            <frame>0</frame>',
        '            <displayformat>NDF</displayformat>',
        '        </timecode>',
        '        <media>',
        '            <video>',
        '                <format>',
        sampleCharacteristicsXml('                    ', sequenceWidth, sequenceHeight),
        '                </format>',
        '                <track>',
        ...clipItems,
        '                </track>',
        '            </video>',
        '        </media>',
        '    </sequence>',
        '</xmeml>',
        ''
    ].join('\n');
}
