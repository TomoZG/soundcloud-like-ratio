# Contributing

Thanks for helping improve SoundCloud Like Ratio.

## Before changing code

- Search existing issues first.
- Open an issue before a large behavior or interface change so the approach can
  be agreed without wasted work.
- Keep changes focused. SoundCloud selector fixes should not be mixed with
  unrelated features or formatting.

No contributor license agreement or developer certificate of origin is
required. Contributions are accepted under the repository's MIT license.

## Development

Use Node.js 22 or newer:

```sh
npm install
npm run check
```

Follow the existing plain JavaScript and CSS style: two-space indentation,
single-quoted JavaScript strings, semicolons, early returns for invalid DOM
state, and `sc-like-ratio-` prefixes for extension CSS classes.

## Testing

Add or update tests under `tests/` for behavior changes. Before opening a pull
request:

1. Run `npm run check`.
2. Load the extension in current stable Chrome and Firefox.
3. Check SoundCloud search and stream pages, exact and abbreviated counts,
   dynamically loaded tracks, missing metrics, accessible labels, filters,
   sorting, and original-order restoration as relevant.
4. Describe the browsers and scenarios tested in the pull request.

Never include account credentials, private SoundCloud content, personal data,
or store publishing secrets in code, fixtures, screenshots, or logs.

## Pull requests

Explain the user-visible effect and why the change is needed. Include a
before/after screenshot or short recording for visible changes. Upstream
SoundCloud selectors are fragile, so call out every selector change explicitly.

Review and support are best-effort; there is no guaranteed response time.
