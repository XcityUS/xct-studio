import { prepareVerifiedPhoto, resizedVerifiedPhotoSize } from '@/features/assets/portrait/prepare-photo';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

describe('verified photo preparation', () => {
    it('only enlarges images slightly below the minimum side while preserving their ratio', () => {
        expect(resizedVerifiedPhotoSize(295, 413)).toEqual({ width: 300, height: 420 });
        expect(resizedVerifiedPhotoSize(413, 295)).toEqual({ width: 420, height: 300 });
        expect(resizedVerifiedPhotoSize(300, 413)).toBeNull();
        expect(resizedVerifiedPhotoSize(200, 413)).toBeNull();
    });

    it('uploads a 295×413 JPEG as a valid 300×420 JPEG with its original name', async () => {
        let bitmapCalls = 0;
        const drawImage = vi.fn();
        const canvas = {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage }),
            toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['resized'], { type: 'image/jpeg' }))
        };
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn(async () => {
                bitmapCalls += 1;
                return {
                    width: bitmapCalls === 3 ? 300 : 295,
                    height: bitmapCalls === 3 ? 420 : 413,
                    close: vi.fn()
                };
            })
        );
        vi.stubGlobal('document', { createElement: () => canvas });

        const original = new File(['jpeg'], 'father.jpg', { type: 'image/jpeg' });
        const prepared = await prepareVerifiedPhoto(original);

        expect(prepared.name).toBe('father.jpg');
        expect(prepared.type).toBe('image/jpeg');
        expect(prepared).not.toBe(original);
        expect([canvas.width, canvas.height]).toEqual([300, 420]);
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 420);
    });

    it('normalizes a decodable JPG MIME alias without resampling valid dimensions', async () => {
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn(async () => ({ width: 413, height: 600, close: vi.fn() }))
        );
        const original = new File(['jpeg'], 'father.jpg', { type: 'image/jpg' });
        const prepared = await prepareVerifiedPhoto(original);
        expect(prepared.name).toBe(original.name);
        expect(prepared.type).toBe('image/jpeg');
        expect(prepared.size).toBe(original.size);
    });
});
