'use client';

import type { AuthorizationTargetOption } from '../types';
import styles from './index.module.scss';
import { Dropdown } from '@/components/ui/Dropdown';
import { ImageIcon, Video } from 'lucide-react';

type AuthorizationReferenceSelectProps = {
    id: string;
    value: string;
    options: AuthorizationTargetOption[];
    disabled: boolean;
    onValueChange: (value: string) => void;
};

function Preview({
    target,
    compact = false,
    inline = false
}: {
    target: AuthorizationTargetOption;
    compact?: boolean;
    inline?: boolean;
}) {
    if (target.kind === 'video') {
        return (
            <span className={styles.videoPreview} data-compact={compact || undefined} data-inline={inline || undefined}>
                <Video size={compact ? 16 : 18} aria-hidden='true' />
            </span>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary signed reference URL
        <img
            src={target.url}
            alt=''
            className={styles.preview}
            data-compact={compact || undefined}
            data-inline={inline || undefined}
            loading='lazy'
        />
    );
}

function SelectedContent({ target }: { target: AuthorizationTargetOption }) {
    return (
        <span className={styles.selected}>
            <Preview target={target} compact inline />
            <span className={styles.selectedTitle}>{target.displayName ?? target.label}</span>
        </span>
    );
}

function OptionContent({ target }: { target: AuthorizationTargetOption }) {
    return (
        <span className={styles.option}>
            <Preview target={target} />
            <span className={styles.optionCopy}>
                <span className={styles.optionTitle}>{target.displayName ?? target.label}</span>
                {(target.description || target.authorizationId) && (
                    <span className={styles.optionMeta}>
                        {[target.description, target.authorizationId].filter(Boolean).join(' · ')}
                    </span>
                )}
            </span>
        </span>
    );
}

export function AuthorizationReferenceSelect({
    id,
    value,
    options,
    disabled,
    onValueChange
}: AuthorizationReferenceSelectProps) {
    return (
        <div className={styles.root}>
            <Dropdown
                id={id}
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                triggerClassName={styles.trigger}
                contentClassName={styles.menu}
                options={options.map((target) => ({
                    value: target.key,
                    textValue: target.label,
                    selectedLabel: <SelectedContent target={target} />,
                    label: <OptionContent target={target} />
                }))}
                placeholder={
                    <span className={styles.selected}>
                        <span className={styles.videoPreview} data-compact data-inline>
                            <ImageIcon size={16} aria-hidden='true' />
                        </span>
                    </span>
                }
            />
        </div>
    );
}
