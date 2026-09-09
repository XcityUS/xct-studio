import styles from './index.module.scss';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
    return <textarea data-slot='textarea' className={clsx(styles.root, className)} {...props} />;
}
