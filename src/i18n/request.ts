import { routing } from './routing';
import enMessages from './messages/en.json';
import zhMessages from './messages/zh.json';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

// Direct dependencies keep dictionary changes in the server config's HMR graph.
const messages = { zh: zhMessages, en: enMessages };

export default getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

    return {
        locale,
        messages: messages[locale]
    };
});
