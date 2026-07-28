# Property content model

Every property is one JSON file in this folder (`castelaria.json`,
`marque-de-lago.json`, ...). That file is the single source of truth: it drives
the property page, the homepage card, SEO, pricing, capacity and photos. To
change anything, edit the JSON and run:

```
python3 tools/build-properties.py
```

You never edit the HTML by hand. Adding a property = one new JSON file + its
photos, then run the command. This keeps every property consistent.

## The core standard (keep properties comparable)

| Slot            | Standard                                  |
|-----------------|-------------------------------------------|
| Gallery photos  | 12–18 (hard cap 18). Quality over volume. |
| Signature cards | Exactly 4 (`features`)                     |
| Amenity groups  | 5–6 categories                            |
| Add-ons         | 4                                          |
| Videos          | 0–2, embedded from YouTube (see below)    |
| Hero stat chips | 5                                          |

## Every editable field

- **Identity**: `name`, `slug` (url + file names), `img_key` (photo folder/prefix), `status` (`live` or `coming-soon`), `order`, `location` (short label shown as the overline), `region`.
- **SEO**: `seo.title`, `seo.description`.
- **Copy**: `tagline`, `story_heading`, `story` (array of paragraphs; the first gets the drop-cap).
- **Pricing**: `pricing.base_nightly_eur`, `currency`, `min_nights`, `pricing.dynamic` (`enabled`, `floor_eur`, `ceiling_eur` — for the future dynamic-pricing engine), `pricing.seasonal` (named date ranges with their own nightly rate).
- **Capacity** (all editable): `capacity.sleeps`, `max_adults`, `max_children`, `bedrooms`, `bathrooms`.
- **Size**: `size.interior_sqm`, `grounds_sqm`, `floors`.
- **Hours**: `hours.check_in`, `hours.check_out`.
- **Hero chips**: `hero_stats` (array of `{n, label}`).
- **Booking card facts**: `aside_facts` (array of `{label, value}`).
- **Signature features**: `features` (4 × `{title, image, text}`; `image` is a photo basename).
- **Gallery**: `gallery.max` and `gallery.images` (array of `{file, caption}`).
- **Videos**: `videos` (array of `{provider:"youtube", id:"<id>", title}`) — empty for now.
- **Amenities**: `amenities` (array of `{category, items[]}`).
- **Setting**: `setting.heading`, `setting.lead`, `setting.map_image`, `setting.proximity` (array of `{value, text}`).
- **Add-ons**: `addons` (array of `{icon, title, text, value}`).
- **Homepage card**: `card.image`, `card.desc`, `card.tags[]`.
- **Cross-sell**: `cross_sell` (slug of the property to feature at the bottom).

## Photos

Put a property's photos in `assets/img/<img_key>/` as basenames referenced by
the JSON (e.g. `castelaria-02`). Generate the web sizes with:

```
python3 tools/optimize-images.py --src "path/to/source.jpg" --name castelaria-02 --outdir assets/img/castelaria
```

The generator auto-detects which widths exist, so a small source that only
makes an 800px file still works. Shared images (like a homepage hero) can live
directly in `assets/img/` and are found automatically.

## Videos (YouTube / social)

Host the property tour on YouTube (unlisted is fine) and add it:

```json
"videos": [
  { "provider": "youtube", "id": "dQw4w9WgXcQ", "title": "Castelaria — the tour" }
]
```

It embeds privacy-first (youtube-nocookie) in a "See it in motion" section. Two
max, to keep pages fast. A native looping hero clip can be added separately.

## Adding a new property (checklist)

1. Copy an existing JSON, change `slug`, `img_key`, and all content.
2. Drop photos into `assets/img/<img_key>/`, optimize them (12–18 for the gallery).
3. Set `status` to `live` and pick an `order`.
4. Run `python3 tools/build-properties.py`. The page and homepage card appear.
