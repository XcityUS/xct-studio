'use client';

import { portraitReferenceUrl } from '@/features/assets/portrait/reference';
import type { VideoCharacter, VideoPortrait } from '@/features/generation/hooks/use-video-history';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
        <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm text-white'>{label}</span>
                <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
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
                                className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pr-2 pl-1 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'>
                                {renderAvatar(item)}
                                <span className='max-w-32 truncate'>{name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
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
    const virtualPortraits = portraits.filter(
        (portrait) =>
            portrait.status === 'Active' && portrait.groupType === 'AIGC' && portrait.referenceOrigin !== 'no-person'
    );

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
                renderAvatar={(character) => (
                    <span className='h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5'>
                        {/* eslint-disable-next-line @next/next/no-img-element -- worker-hosted URL */}
                        <img
                            src={character.url}
                            alt={character.name}
                            loading='lazy'
                            className='h-full w-full object-cover'
                        />
                    </span>
                )}
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
                renderAvatar={() => (
                    <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10'>
                        <ShieldCheck className='h-3 w-3 text-emerald-300' />
                    </span>
                )}
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
                renderAvatar={() => (
                    <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-200/10'>
                        <Sparkles className='h-3 w-3 text-cyan-200' />
                    </span>
                )}
                onAttach={onAttachPortrait}
            />
        </>
    );
}
