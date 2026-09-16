'use client';

import styles from './index.module.scss';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type PortraitPhotoUploadProps = {
    disabled?: boolean;
    onUpload: (file: File) => Promise<void>;
};

export function PortraitPhotoUpload({ disabled = false, onUpload }: PortraitPhotoUploadProps) {
    const t = useTranslations();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setIsUploading(true);
        try {
            await onUpload(file);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                className={styles.input}
                type='file'
                accept='image/png,image/jpeg,image/webp'
                onChange={(event) => void handleChange(event)}
                disabled={disabled || isUploading}
                tabIndex={-1}
            />
            <button
                type='button'
                className={styles.button}
                disabled={disabled || isUploading}
                onClick={() => inputRef.current?.click()}>
                {isUploading ? (
                    <Loader2 className={styles.spinner} aria-hidden='true' />
                ) : (
                    <ImagePlus aria-hidden='true' />
                )}
                {isUploading ? t('Uploading photo') : t('Upload photo')}
            </button>
        </>
    );
}
