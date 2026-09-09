'use client';

import styles from './index.module.scss';
import { virtualCharacterOptions } from './options';
import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import { characterPreviewUrl } from '@/features/generation/history/characters';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import { cn } from '@/shared/utils/classnames';
import { Check, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type CharacterSelectorsProps = {
    characters: VideoCharacter[];
    portraits: VideoPortrait[];
    referenceUrls: string[];
    referenceLimit: number;
    disabled: boolean;
    onAttachCharacter: (character: VideoCharacter) => void;
    onAttachPortrait: (portrait: VideoPortrait) => void;
};

type SelectorProps<T> = {
    items: T[];
    label: string;
    referenceUrls: string[];
    referenceLimit: number;
    disabled: boolean;
    getId: (item: T) => string;
    getName: (item: T) => string;
    getUrl: (item: T) => string;
    renderAvatar: (item: T) => React.ReactNode;
    onAttach: (item: T) => void;
};

function Selector<T>({
    items,
    label,
    referenceUrls,
    referenceLimit,
    disabled,
    getId,
    getName,
    getUrl,
    renderAvatar,
    onAttach
}: SelectorProps<T>) {
    const t = useTranslations();
    if (items.length === 0) return null;

    return (
        <div className={styles.row}>
            <span className={styles.label}>{label}</span>
            <div className={styles.options}>
                {items.map((item) => {
                    const url = getUrl(item);
                    const name = getName(item);
                    const isAttached = referenceUrls.includes(url);
                    const isDisabled = disabled || (!isAttached && referenceUrls.length >= referenceLimit);
                    return (
                        <button
                            key={getId(item)}
                            type='button'
                            title={
                                isDisabled && !isAttached
                                    ? t('Reference limit reached <lpar><lcur>limit<rcur><rpar>', {
                                          limit: referenceLimit
                                      })
                                    : t('Attach <lcur>name<rcur>', { name })
                            }
                            onClick={() => onAttach(item)}
                            disabled={isDisabled}
                            aria-pressed={isAttached}
                            className={cn(styles.option, isAttached && styles.selected)}>
                            {renderAvatar(item)}
                            <span className={styles.name}>{name}</span>
                            {isAttached && <Check className={styles.selectedMark} aria-hidden='true' />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AvatarImage({ src, alt, fallback }: { src: string; alt: string; fallback: React.ReactNode }) {
    const [failed, setFailed] = React.useState(false);
    if (failed) return fallback;
    // eslint-disable-next-line @next/next/no-img-element -- provider or worker-hosted thumbnail
    return <img src={src} alt={alt} loading='lazy' onError={() => setFailed(true)} />;
}

function PortraitAvatar({ portrait, virtual }: { portrait: VideoPortrait; virtual: boolean }) {
    const TypeIcon = virtual ? Sparkles : ShieldCheck;
    return (
        <span className={styles.avatar}>
            <AvatarImage
                key={portrait.thumbUrl}
                src={portrait.thumbUrl}
                alt=''
                fallback={<UserRound className={styles.avatarIcon} aria-hidden='true' />}
            />
            <span className={styles.portraitType} aria-hidden='true'>
                <TypeIcon />
            </span>
        </span>
    );
}

export function CharacterSelectors({
    characters,
    portraits,
    referenceUrls,
    referenceLimit,
    disabled,
    onAttachCharacter,
    onAttachPortrait
}: CharacterSelectorsProps) {
    const t = useTranslations();
    const verifiedPortraits = portraits.filter(
        (portrait) => portrait.status === 'Active' && portrait.groupType === 'LivenessFace'
    );
    const virtualPortraits = virtualCharacterOptions(portraits, referenceUrls);

    return (
        <>
            <Selector
                items={characters}
                label={t('Characters<colon>')}
                referenceUrls={referenceUrls}
                referenceLimit={referenceLimit}
                disabled={disabled}
                getId={(character) => character.id}
                getName={(character) => character.name}
                getUrl={(character) => character.url}
                renderAvatar={(character) => {
                    const previewUrl = characterPreviewUrl(character, portraits);
                    return (
                        <span className={styles.avatar}>
                            {previewUrl ? (
                                <AvatarImage
                                    key={previewUrl}
                                    src={previewUrl}
                                    alt={character.name}
                                    fallback={<UserRound className={styles.avatarIcon} aria-hidden='true' />}
                                />
                            ) : (
                                <UserRound className={styles.avatarIcon} aria-hidden='true' />
                            )}
                        </span>
                    );
                }}
                onAttach={onAttachCharacter}
            />
            <Selector
                items={verifiedPortraits}
                label={t('Verified people<colon>')}
                referenceUrls={referenceUrls}
                referenceLimit={referenceLimit}
                disabled={disabled}
                getId={(portrait) => portrait.assetId}
                getName={(portrait) => portrait.name}
                getUrl={(portrait) => portraitReferenceUrl(portrait.assetId)}
                renderAvatar={(portrait) => <PortraitAvatar portrait={portrait} virtual={false} />}
                onAttach={onAttachPortrait}
            />
            <Selector
                items={virtualPortraits}
                label={t('Virtual characters<colon>')}
                referenceUrls={referenceUrls}
                referenceLimit={referenceLimit}
                disabled={disabled}
                getId={(portrait) => portrait.assetId}
                getName={(portrait) => portrait.name}
                getUrl={(portrait) => portraitReferenceUrl(portrait.assetId)}
                renderAvatar={(portrait) => <PortraitAvatar portrait={portrait} virtual />}
                onAttach={onAttachPortrait}
            />
        </>
    );
}
