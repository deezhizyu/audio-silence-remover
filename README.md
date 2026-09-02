# Audio Tools

A fully client-side toolkit for editing audio files — right in your browser. It currently includes
a silence remover (short, medium, and long pauses are detected automatically, then each category is
yours to fine-tune — threshold, cut length, and more) and an audio alignment tool for lining up
multiple takes of the same recording. Nothing is uploaded; decoding, analysis, and export all run
locally.

[![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)](https://preactjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

## Development

```bash
pnpm install
pnpm dev
```

The dev server starts on [localhost:5173](http://localhost:5173).

## Testing

```bash
pnpm test
```

## Commit style

`type: imperative summary` — optionally ` — comma-separated details` for multi-part changes.
Lowercase, no trailing period.

Types: `feat`, `ui`, `perf`, `ci`, `fix`.

```
feat: auto-detect "replaced with" length as half the category's minimum
ui: polish controls — threshold wording, matched button shadows, no play outline, softer card hover
```
