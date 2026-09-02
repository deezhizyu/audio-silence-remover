/** Vite's configured base ('/' locally, '/audio-tools/' on GitHub Pages CI builds — see
    vite.config.ts), normalized to a prefix with no trailing slash so route paths can be built as
    `${BASE_PATH}/alignment`. */
export const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');
