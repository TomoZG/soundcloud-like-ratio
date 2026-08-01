# Browser Store Listing

## Shared metadata

- Name: SoundCloud Like Ratio
- Language: English
- Publisher/display name: TomoZG
- Homepage: https://github.com/TomoZG/soundcloud-like-ratio
- Support: https://github.com/TomoZG/soundcloud-like-ratio/issues
- License: MIT

Short description:

> Shows SoundCloud like percentages and can filter or sort loaded tracks.

Long description:

> SoundCloud Like Ratio shows the percentage of a track's plays that resulted
> in a like, directly beside the track's Like button. It understands exact and
> abbreviated metrics, marks estimates with ≈, and updates as SoundCloud loads
> more tracks.
>
> Use the Filter & sort panel to set minimum play and like counts, sort loaded
> tracks by like percentage, or restore SoundCloud's original order. Tracks
> with unreadable metrics remain visible.
>
> Everything is processed locally in the current browser tab. The extension
> has no analytics, advertising, accounts, persistent storage, or
> extension-originated network requests.
>
> SoundCloud is a trademark of SoundCloud Global Limited & Co. KG. This
> independent extension is not affiliated with or endorsed by SoundCloud.

## Chrome Web Store

- Category: Productivity
- Visibility: Public, all regions
- Mature content: No
- Trading status: Non-trader, subject to the publisher's final legal assessment
- Single purpose: Show each visible SoundCloud track's likes-to-plays percentage
  and let the user filter or sort loaded tracks by those public metrics.
- Host access justification: Access is limited to `https://soundcloud.com/*` so
  the content script can read visible like/play metrics and insert the requested
  ratio, filter, and sort interface on SoundCloud pages.
- Remote code: None

Privacy disclosures:

- Website content: accessed and processed locally for the single purpose.
- Personally identifying information: not collected or transmitted.
- Browsing history/activity: not collected or transmitted to the developer.
- Authentication, financial, health, communications, location, and form data:
  not collected or transmitted.
- Sale, transfer, advertising, analytics, and human access: none.
- Limited Use certification: affirm only while the package and privacy policy
  remain consistent with these statements.

Required uploads:

- `icons/icon-128.png`
- `store-assets/generated/small-promo-tile.png`
- At least one approved screenshot from `store-assets/screenshots/`

## Firefox Add-ons

- Category: Photos, Music & Videos
- Distribution: Listed
- Data collection/transmission: None
- Separate source upload: No; the extension ZIP contains direct, readable,
  unminified source and the packaging step only selects and compresses files.

## Reviewer instructions

1. Install the submitted ZIP.
2. Open a SoundCloud search or stream page containing tracks with visible play
   and like counts.
3. Confirm a percentage appears beside each supported Like button.
4. Open **Filter & sort**, enter minimum play/like thresholds, and verify tracks
   below known thresholds are hidden.
5. Select **Like ratio — highest first**, then use **Reset** to restore the
   original order.
6. Scroll to load more tracks and confirm the ratio and active controls apply
   to newly loaded results.

No separate extension account, credentials, paid feature, or external service
is required. SoundCloud may independently require its normal site login in some
regions or sessions.
