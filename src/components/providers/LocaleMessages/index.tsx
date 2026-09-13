'use client';

import enMessages from '@/i18n/messages/en.json';
import zhMessages from '@/i18n/messages/zh.json';
import type { AppLocale } from '@/i18n/routing';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof NextIntlClientProvider> & { locale: AppLocale };

export function LocaleMessages({ locale, messages, ...props }: Props) {
    // Fast Refresh can replace consumers before a retained layout receives new RSC props.
    // Keep development dictionaries in the same client update graph as the provider.
    // Production continues using only the server-selected locale's messages.
    const currentMessages = process.env.NODE_ENV === 'development'
        ? (locale === 'zh' ? zhMessages : enMessages)
        : messages;

    return <NextIntlClientProvider {...props} locale={locale} messages={currentMessages} />;
}
