'use client';

import styles from './index.module.scss';
import { extractScriptFile, ScriptImportError } from '@/features/script/import/client';
import { FileText, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const ACCEPTED_SCRIPT_FILES = '.txt,.md,.doc,.docx,.pdf';

type ScriptImportFieldProps = {
    disabled: boolean;
    value: string;
    onChange: (value: string) => void;
    onError: (message: string | null) => void;
};

export function ScriptImportField({ disabled, value, onChange, onError }: ScriptImportFieldProps) {
    const t = useTranslations();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [filename, setFilename] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);

    const importFile = async (file?: File) => {
        if (!file || disabled || isImporting) return;
        setIsImporting(true);
        onError(null);
        try {
            const result = await extractScriptFile(file);
            onChange(result.text);
            setFilename(result.filename);
        } catch (error) {
            setFilename(null);
            if (error instanceof ScriptImportError) {
                const messages: Record<string, string> = {
                    FILE_TOO_LARGE: t('The script file must be 20 MB or smaller'),
                    UNSUPPORTED_FILE: t(
                        'Supported script formats are TXT<comma> Markdown<comma> DOC<comma> DOCX<comma> and PDF'
                    ),
                    EMPTY_FILE: t('The script file did not contain readable text'),
                    EXTRACTION_FAILED: t('The script file is encrypted<comma> damaged<comma> or unreadable')
                };
                onError(messages[error.code] || t('Could not read this script file'));
            } else {
                onError(t('Could not read this script file'));
            }
        } finally {
            setIsImporting(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className={styles.root}>
            <div
                className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
                onDragEnter={(event) => {
                    event.preventDefault();
                    if (!disabled) setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    void importFile(event.dataTransfer.files[0]);
                }}>
                <input
                    ref={inputRef}
                    type='file'
                    accept={ACCEPTED_SCRIPT_FILES}
                    className={styles.input}
                    disabled={disabled || isImporting}
                    onChange={(event) => void importFile(event.target.files?.[0])}
                />
                <button
                    type='button'
                    className={styles.button}
                    disabled={disabled || isImporting}
                    onClick={() => inputRef.current?.click()}>
                    {isImporting ? (
                        <Loader2 className={styles.spinner} aria-hidden='true' />
                    ) : (
                        <Upload aria-hidden='true' />
                    )}
                    {isImporting ? t('Reading script file<hellip>') : t('Upload script file')}
                </button>
                <span className={styles.help}>{t('TXT<comma> Markdown<comma> Word or PDF up to 20 MB')}</span>
            </div>
            {filename && (
                <p className={styles.file} title={filename}>
                    <FileText aria-hidden='true' />
                    <span>{filename}</span>
                    <span className={styles.count}>{t('<lcur>count<rcur> characters', { count: value.length })}</span>
                </p>
            )}
        </div>
    );
}
