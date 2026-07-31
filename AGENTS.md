# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Chrome and Firefox Manifest V3 extension. Runtime files live at the repository root:

- `manifest.json` registers the content script and stylesheet for `soundcloud.com`.
- `content.js` reads SoundCloud metrics, renders ratio badges, observes SPA updates, and manages sorting.
- `styles.css` styles badges, confidence states, and the fixed sort control.
- `README.md` documents installation, selectors, and user-facing behavior.
- `tests/` contains Node test-runner and jsdom regression tests.

Keep extension runtime assets at the root, tests under `tests/`, and development utilities under `scripts/`. Update the manifest whenever adding a runtime script, stylesheet, permission, or asset.

## Build, Test, and Development Commands

There is no compilation step. Use Node.js 22 or newer for development tooling. Load the repository directly through `chrome://extensions` or Firefox's `about:debugging` page.

- `npm install` installs the pinned development dependencies.
- `npm test` runs calculation and DOM behavior tests.
- `npm run lint` checks JavaScript syntax and validates the extension manifest.
- `npm run check` runs the complete automated validation suite.
- `npm run start:chrome` or `npm run start:firefox` starts a temporary browser session.

## Coding Style & Naming Conventions

Follow the existing plain JavaScript and CSS style: two-space indentation, semicolons, single-quoted JavaScript strings, trailing commas only where already natural, and early returns for invalid DOM state. Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants, and kebab-case extension CSS classes prefixed with `sc-like-ratio-`. Keep selectors centralized in `SELECTORS` when practical. Preserve the IIFE and strict mode so the content script does not leak globals.

## Testing Guidelines

Tests use Node's test runner with jsdom; no coverage threshold is configured. Name tests `tests/*.test.js`. Run `npm run check`, then test manually on SoundCloud search and stream pages. Verify exact and abbreviated counts (`10.1K`), dynamically loaded tracks, invalid or missing metrics, badge accessibility text, sort order, and **Restore order**. Document the browsers and scenarios tested in the pull request.

## Commit & Pull Request Guidelines

History currently contains only `Initial commit`, so no mature convention exists. Use short, imperative commit subjects such as `Handle localized play counts`; keep unrelated changes separate. Pull requests should explain the behavior change, note manual verification, and link any relevant issue. Include before/after screenshots or a short recording for visible UI changes, and call out updated SoundCloud selectors because upstream markup is outside this project’s control.
