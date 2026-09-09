import { routing } from './routing';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

const messageLoaders = {
    zh: () => import('./messages/zh.json'),
    en: () => import('./messages/en.json')
};

export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

    return {
        locale,
        messages: (await messageLoaders[locale]()).default
    };
});
