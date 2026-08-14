# Silence Remover

A fully client-side web app that trims silence out of audio files in the browser — no server, no
uploads. Detection, waveform rendering, and MP3/WAV export all run locally (an off-main-thread
worker handles analysis).

## Technologies

- **Preact** (not React) with signals (`@preact/signals`) for state
- **TypeScript**, strict, `moduleResolution: bundler`, `verbatimModuleSyntax`
- **Vite** for build/dev, **Tailwind CSS v4** (via `@tailwindcss/vite`, no config file) for styling
- **Vitest** for unit tests
- **mediabunny** / `@mediabunny/mp3-encoder` for audio decoding and encoding
- **pnpm** as the package manager (version pinned in `package.json` `devEngines`)
- Deployed as a static site to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)

Don't introduce a different framework, state library, CSS approach, or package manager — use what's
already here.

## Project structure

- `src/audio/` — pure audio logic: decoding, silence detection, cut planning, encoding. No Preact
  imports here.
  - `src/audio/worker/` — the analysis Web Worker and its message-passing client
- `src/components/` — Preact components, one per file, named after the component (`PascalCase.tsx`)
  - `src/components/ui/` — small generic UI primitives (`Button`, `Card`, `RangeControl`, ...)
- `src/state/` — signals-based app state and persistence
- `src/utils/` — small generic helpers not specific to audio or UI
- Colocated tests as `*.test.ts` next to the file they test

One file = one responsibility. A file exports one main thing (a component, a function, a type
group); don't pile unrelated helpers into a shared "utils" catch-all when they belong closer to
their use.

## Code style

- No duplication. If similar logic appears twice, extract it into a shared, named function before
  writing a third callsite — don't copy-paste-tweak.
- Full, descriptive names for everything: functions, variables, and files. No abbreviations or
  shortened names (`config` not `cfg`, `amplitudeEnvelope` not `ampEnv`), even in local scope. A
  reader shouldn't need to guess what a name stands for.
- Favor small, pure, single-purpose functions over large multi-step ones. Each function should read
  as one clear operation.
- Comments explain *why*, not *what* — used sparingly, for non-obvious constraints, invariants, or
  reasoning that the code itself can't express (see `src/audio/detectSilenceRegions.ts` for the
  style). Don't narrate what a line already makes obvious.
- No shortcuts, TODOs, or half-finished code paths. Write it complete or don't write it.
- Prefer editing/extending existing modules over adding new abstractions unless the task clearly
  calls for a new one.

## Commit style

Format: `type: imperative summary` — optionally followed by ` — comma-separated details` for
multi-part changes. Lowercase type, lowercase summary start, no trailing period.

Types used in this repo: `feat`, `ui`, `perf`, `ci`, `fix`.

Examples:
- `feat: auto-detect "replaced with" length as half the category's minimum`
- `ui: polish controls — threshold wording, matched button shadows, no play outline, softer card hover`
- `perf: speed up silence detection and waveform rendering, fix download bug`

Only commit when explicitly asked.
