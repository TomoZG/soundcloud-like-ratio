# Store Assets

This directory contains version-controlled source, generated artwork, and
metadata retained for possible future browser-store publication. The extension
is currently distributed through GitHub Releases only.

- `source/icon.svg` is the original extension icon.
- `source/small-promo-tile.svg` is the editable Chrome promotional tile.
- `generated/small-promo-tile.png` is the required 440×280 upload.
- `screenshots/` contains 1280×800 captures from a live browser with the current
  release build installed, plus the recapture checklist.

Run `scripts/render-assets.sh` on a system with `rsvg-convert` to reproduce the
PNG artwork. Runtime icons are written to `icons/`; store-only artwork is kept
outside the extension package.

Do not add SoundCloud's logo, private account information, unpublished tracks,
or misleading mockups to store artwork.
