# SoundCloud Like Ratio

Chrome and Firefox Manifest V3 extension that displays the like rate beside each
SoundCloud track's Like button.

Example:

`≈3.63%`

This means approximately 3.63% of plays resulted in a like.

## Install locally in Chrome

1. Extract the ZIP.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `soundcloud-like-ratio` directory.
6. Refresh SoundCloud.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select this repository's `manifest.json`.
4. Open or refresh SoundCloud.

Firefox removes temporary add-ons when the browser closes. For an auto-reloading
development session, install the project dependencies and run
`npm run start:firefox`.

## Development checks

Use Node.js 22 or newer:

- `npm install` installs the pinned development tools.
- `npm test` runs calculation and DOM behavior tests.
- `npm run lint` validates JavaScript syntax and the extension manifest.
- `npm run check` runs all automated checks.
- `npm run start:chrome` or `npm run start:firefox` opens SoundCloud with the
  extension loaded temporarily.

## DOM selectors

The extension uses the current SoundCloud search-result markup:

- track: `li.soundList__item`
- likes: `button.sc-button-like .sc-button-label`
- plays: `.sc-ministats-plays`
- exact play count: closest `li.sc-ministats-item` `title` attribute

SoundCloud abbreviates some like counts, such as `10.1K`; those calculated ratios
are prefixed with `≈`.


## Visibility by play count

The percentage is intentionally muted when the raw like rate is less comparable:

- under 1,000 plays: `55%` opacity because the sample is small
- 1,000 to 999,999 plays: full opacity
- 1 million to 9,999,999 plays: `82%` opacity
- 10 million or more plays: `68%` opacity

The displayed percentage is always the unmodified likes-per-plays value.

## Sorting

A `Sort by % ↓` button appears in the bottom-right corner when at least two tracks
have valid like percentages. It sorts all currently loaded songs by percentage,
highest first. While sorting is active, newly loaded songs are inserted into the
same order. Click `Restore order` to return to SoundCloud's original order.
