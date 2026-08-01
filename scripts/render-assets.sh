#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
icon_source="$project_root/store-assets/source/icon.svg"
promo_source="$project_root/store-assets/source/small-promo-tile.svg"

mkdir -p "$project_root/icons" "$project_root/store-assets/generated"

for size in 16 32 48 128; do
  rsvg-convert \
    --width "$size" \
    --height "$size" \
    --output "$project_root/icons/icon-$size.png" \
    "$icon_source"
done

rsvg-convert \
  --width 440 \
  --height 280 \
  --output "$project_root/store-assets/generated/small-promo-tile.png" \
  "$promo_source"

echo 'Rendered extension and store assets.'
