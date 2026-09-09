import styles from './index.module.scss';
import type { UserAsset } from '@/lib/media-archive';

type AssetImageOptionProps = {
    asset: UserAsset;
    label: string;
};

export function AssetImageOption({ asset, label }: AssetImageOptionProps) {
    return (
        <span className={styles.option}>
            {/* eslint-disable-next-line @next/next/no-img-element -- user media can be served by configured worker hosts */}
            <img className={styles.thumbnail} src={asset.url} alt='' loading='lazy' />
            <span className={styles.label}>{label}</span>
        </span>
    );
}
