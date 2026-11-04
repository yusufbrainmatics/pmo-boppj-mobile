const baca = () => location.hash.slice(1) || '/'

export const nav = $state({ raw: baca() })
addEventListener('hashchange', () => (nav.raw = baca()))

export const path = () => nav.raw.split('?')[0]
export const query = () => Object.fromEntries(new URLSearchParams(nav.raw.split('?')[1] ?? ''))
export const go = (p) => (location.hash = p)
export const back = (fallback = '/') => (history.length > 1 ? history.back() : go(fallback))
