import styles from './index.module.scss';

export function ActivityGraphic() {
    return (
        <>
            <div className={styles.ambient} aria-hidden='true' />
            <div className={styles.orbit} aria-hidden='true'>
                <span className={styles.core} />
            </div>
        </>
    );
}
