export const keyTokens: Readonly<Record<string, string>> = {
    "'": 'apos',
    '"': 'quot',
    '/': 'slash',
    '%': 'pct',
    $: 'usd',
    '(': 'lpar',
    ')': 'rpar',
    '{': 'lcur',
    '}': 'rcur',
    '[': 'lbrk',
    ']': 'rbrk',
    ':': 'colon',
    ';': 'semi',
    ',': 'comma',
    '.': 'dot',
    '&': 'and',
    '+': 'plus',
    '-': 'dash',
    '?': 'q',
    '!': 'bang',
    '#': 'hash',
    '@': 'at',
    '|': 'pipe',
    '<': 'lt',
    '>': 'gt',
    '=': 'eq',
    '*': 'star',
    '~': 'tilde',
    '`': 'btick',
    '\\': 'bslash',
    '\u00a9': 'copy',
    '\u2192': 'rarr',
    '\u2014': 'mdash',
    '\u2026': 'hellip'
};

const tokens = new Set(Object.values(keyTokens));

export function isMessageKey(key: string): boolean {
    if (!key || key !== key.trim() || /\s{2}/.test(key)) return false;
    const plain = key.replace(/<([a-z]+)>/g, (token, name: string) => (tokens.has(name) ? '' : token));
    return /^[A-Za-z0-9 _]*$/.test(plain);
}

export function normalizeMessageKey(english: string): string {
    const text = english
        .normalize('NFC')
        .trim()
        .replace(/^\.+|\.+$/g, '');
    // Tokenize the original characters once; never tokenize generated angle brackets again.
    const key = Array.from(text, (char) => (keyTokens[char] ? `<${keyTokens[char]}>` : char))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    if (!isMessageKey(key)) throw new Error('English copy produces an empty or unsupported message key.');
    return key;
}
