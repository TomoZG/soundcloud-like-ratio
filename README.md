# SoundCloud Like Ratio

SoundCloud Like Ratio is an independent Chrome and Firefox extension that shows
the percentage of plays that resulted in a like. It can also filter loaded
tracks by minimum play or like counts and sort them by like percentage.

Example: `≈3.63%` means approximately 3.63% of plays resulted in a like. The
`≈` marker appears when SoundCloud provides an abbreviated metric such as
`10.1K`.

> SoundCloud is a trademark of SoundCloud Global Limited & Co. KG. This project
> is not affiliated with or endorsed by SoundCloud.

## Install

Chrome Web Store and Firefox Add-ons links will be added after the first public
store review.

To install a GitHub Release manually:

1. Download `soundcloud-like-ratio-<version>.zip` from the Releases page.
2. Extract the archive.
3. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose
   **Load unpacked**, and select the extracted directory.
4. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load
   Temporary Add-on**, and select the extracted `manifest.json`.

Firefox removes temporary add-ons when the browser closes.

### Verify a release

Each installable ZIP includes a SHA-256 checksum and GitHub build-provenance
attestation:

```sh
sha256sum -c soundcloud-like-ratio-<version>.zip.sha256
gh attestation verify soundcloud-like-ratio-<version>.zip \
  --repo TomoZG/soundcloud-like-ratio
```

GitHub also adds automatic “Source code” archives to every release. Those
contain the whole repository; the explicitly named `soundcloud-like-ratio-*.zip`
asset is the minimal extension package submitted to the browser stores.

## Privacy

The extension reads visible like and play counts from SoundCloud and processes
them locally in the current browser tab. It has no analytics, advertising,
accounts, persistent storage, or extension-originated network requests. See the
full [privacy policy](PRIVACY.md).

## Filtering and sorting

A **Filter & sort** button appears in the bottom-right corner when a supported
track is present:

- **Minimum plays** and **Minimum likes** hide known counts below the threshold.
- **Order** switches between SoundCloud's original order and like percentage,
  highest first.
- **Reset** clears thresholds and restores the original order.

Tracks with unreadable metrics remain visible. Settings apply to tracks loaded
later by SoundCloud and survive in-page navigation, but reset when the page or
tab reloads.

## Development

Use Node.js 22 or newer:

```sh
npm install
npm run check
```

Useful commands:

- `npm test` runs calculation and DOM behavior tests.
- `npm run lint` validates JavaScript and the extension manifest.
- `npm run build` creates the minimal extension ZIP.
- `npm run verify:package` checks the ZIP against the runtime-file allow-list.
- `npm run start:chrome` or `npm run start:firefox` starts a temporary browser
  session.
- `scripts/render-assets.sh` recreates icons and the Chrome promotional tile
  from the version-controlled SVG sources.

The extension currently targets SoundCloud list and stream track markup. Since
that upstream markup is outside this project's control, selector changes should
include regression tests and manual checks in both browsers.

## Contributing and support

Bug reports and focused improvements are welcome through GitHub Issues. Support
and review are best-effort with no response-time guarantee. See
[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before opening a
pull request or reporting a vulnerability.

## License

MIT. See [LICENSE](LICENSE).
