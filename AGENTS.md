# Repository Guidelines

## Project Structure & Module Organization

This repository contains a dependency-free Chrome Manifest V3 extension. All runtime files live at the repository root:

- `manifest.json` registers the content script and stylesheet for `soundcloud.com`.
- `content.js` reads SoundCloud metrics, renders ratio badges, observes SPA updates, and manages sorting.
- `styles.css` styles badges, confidence states, and the fixed sort control.
- `README.md` documents installation, selectors, and user-facing behavior.

Keep new runtime assets beside these files unless the project grows enough to justify `src/` and `tests/` directories. Update the manifest whenever adding a script, stylesheet, permission, or asset.

## Build, Test, and Development Commands

There is no compilation step or package manager. Load the repository directly through `chrome://extensions` using **Load unpacked**.

- `node --check content.js` checks JavaScript syntax without running browser APIs.
- `git diff --check` catches whitespace errors before committing.
- Reload the extension from `chrome://extensions`, then refresh a SoundCloud page to exercise changes.

## Coding Style & Naming Conventions

Follow the existing plain JavaScript and CSS style: two-space indentation, semicolons, single-quoted JavaScript strings, trailing commas only where already natural, and early returns for invalid DOM state. Use `camelCase` for functions and variables, `UPPER_SNAKE_CASE` for constants, and kebab-case extension CSS classes prefixed with `sc-like-ratio-`. Keep selectors centralized in `SELECTORS` when practical. Preserve the IIFE and strict mode so the content script does not leak globals.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Run the syntax and whitespace checks above, then test manually on SoundCloud search and stream pages. Verify exact and abbreviated counts (`10.1K`), dynamically loaded tracks, invalid or missing metrics, badge accessibility text, sort order, and **Restore order**. Document the pages and scenarios tested in the pull request.

## Commit & Pull Request Guidelines

History currently contains only `Initial commit`, so no mature convention exists. Use short, imperative commit subjects such as `Handle localized play counts`; keep unrelated changes separate. Pull requests should explain the behavior change, note manual verification, and link any relevant issue. Include before/after screenshots or a short recording for visible UI changes, and call out updated SoundCloud selectors because upstream markup is outside this project’s control.
