# Pixel Art Dashboard Integration — Design Spec

**Date:** 2026-06-20
**Status:** Approved

## Overview

Integrate 217 pixel art JPG images (generated via Gemini API into `pixel-art-output/`) into the AGPA dashboard. Replace emoji-based achievement icons with pixel art images across ALL display locations. Locked (unearned) achievements show extremely blurred versions of their pixel art.

## Architecture

```
pixel-art-output/*.jpg  ──copy──▶  src/dashboard/public/pixel-art/*.jpg
                                          │
                                          ▼
                              server.ts static file serving
                              (+ image/jpeg MIME type)
                                          │
                                          ▼
                              api.ts: adds pixel_art_url field
                              derived from achievement ID
                              "/pixel-art/{id}.jpg"
                                          │
                                          ▼
                              app.js: iconHtml() renders <img>
                              + CSS blur filter for locked state
```

## Files Changed

| Layer | File | Change |
|-------|------|--------|
| Static assets | `src/dashboard/public/pixel-art/` | NEW directory: copy all `.jpg` from `pixel-art-output/` |
| Server | `src/dashboard/server.ts` | Add `.jpg` / `.jpeg` → `image/jpeg` to MIME_TYPES |
| API | `src/dashboard/api.ts` | Add `pixel_art_url?: string` to `AchievementItem`, `SetAchievementMember`, `CardAchievement`, `QuestlineStageItem`; populate from def id |
| Frontend | `src/dashboard/public/app.js` | `iconHtml()`: detect `/pixel-art/` path → `<img>` with blur class when locked; questline rendering pass `pixel_art_url` to icon |
| Frontend | `src/dashboard/public/styles.css` | `.ach-icon img.locked-blur` — extreme blur + grayscale + reduced opacity |

### URL Convention

```ts
function pixelArtUrl(id: string): string {
  return `/pixel-art/${id}.jpg`;
}
```

The file existence check is NOT done server-side — if an image is missing, the browser `<img>` will show broken-image fallback. This is acceptable because:
- All 217 achievement images have been generated
- The generation script ensures 1:1 coverage
- Adding server-side existence checks adds complexity with no user-facing benefit

## Display Locations (all replaced)

| Location | app.js function | Current | After |
|----------|----------------|---------|-------|
| Achievement card grid | `renderGrid()` | emoji span | `<img>` with pixel art |
| Achievement detail modal | `showDetail()` | emoji span | `<img>` with pixel art |
| Showcase slots | `renderShowcase()` | emoji span | `<img>` with pixel art |
| Set member badges | `renderSets()` | emoji span | `<img>` with pixel art |
| Set card headers | `renderSets()` | emoji span | `<img>` with pixel art |
| Timeline entries | `renderTimeline()` | emoji span | `<img>` with pixel art |
| Questline card header | `renderQuestlines()` | emoji span | `<img>` with pixel art |
| Questline stage badges | `renderQuestlines()` | emoji span | `<img>` with pixel art |

## Locked State Behavior

- **Non-hidden, locked**: show pixel art with `.locked-blur` class
  - `filter: blur(12px) grayscale(0.6) brightness(0.5);`
  - `opacity: 0.4;`
- **Hidden AND locked**: show 🔒 lock emoji (existing behavior preserved — no point blurring an image the user shouldn't know about)
- **Unlocked**: full pixel art, no filter

## Questline Images

Questline IDs map to the same image naming convention: `/pixel-art/{questline_id}.jpg`. Questlines that don't have a matching image (none currently expected) fall back to emoji.

## Edge Cases

- **Missing image file**: browser shows broken-image icon. Acceptable — all known images exist.
- **New achievements without pixel art**: `pixel_art_url` is `undefined` → `iconHtml()` falls through to existing emoji rendering.
- **Dashboard refresh / auto-poll**: images are cached by browser via standard HTTP caching. No special cache-busting needed since filenames are stable.
- **Customize page**: `/customize` page uses its own rendering. Images are shown there too since it reuses the same `iconHtml()` logic.

## Not in Scope

- Questline-specific pixel art (distinct from achievement pixel art) — current images cover questlines via same-ID convention
- Pixel art for profile avatars, tool logos, or other non-achievement graphics
- Animated/gif pixel art
- Retina/high-DPI variants (48×48 at current pixel art resolution is fine)

## Testing

- Verify all 217 `.jpg` files exist in `public/pixel-art/` after copy
- Smoke test dashboard: grid, modal, showcase, sets, questlines, timeline all show images
- Verify locked achievements show blurred images
- Verify hidden+locked achievements still show 🔒
- Verify unlock transition: blur class removed on unlock
