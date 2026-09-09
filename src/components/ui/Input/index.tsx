import styles from './index.module.scss';
import { clsx } from 'clsx';
import type { ComponentProps } from 'react';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return <input type={type} data-slot='input' className={clsx(styles.root, className)} {...props} />;
}
