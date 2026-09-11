import styles from './index.module.scss';
import { cn } from '@/shared/utils/classnames';

export function CardSkeleton() {
    return (
        <div className={cn('flex flex-col', styles.card, styles.skeletonCard)} aria-hidden='true'>
            <div className={styles.media} />
            <div className={styles.details}>
                <div className={cn(styles.line, styles.lineFull)} />
                <div className={styles.meta}>
                    <div className={cn(styles.line, styles.lineShort)} />
                    <div className={cn(styles.line, styles.lineTiny)} />
                </div>
                <div className={styles.actions}>
                    <div />
                    <div />
                    <div />
                </div>
            </div>
        </div>
    );
}
