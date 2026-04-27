## Goal

Replace both fonts in StandardsTrack (Fraunces serif headings + Inter body) with **Nunito Sans** used everywhere, then generate a polished product-shot mockup so you can see the new look in context before deciding to keep it.

## Why one font, not two

Nunito Sans has 9 weights (200–900). We'll use heavier weights (700/800) for headings and regular/medium (400/500) for body. This gives clear hierarchy without needing a separate display font, and keeps every screen consistently readable.

## Changes

### 1. Load Nunito Sans, drop Fraunces + Inter
**`index.html`** — replace the Google Fonts `<link>` tag:
```html
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

### 2. Update Tailwind font families
**`tailwind.config.ts`** — point both `display` and `sans` at Nunito Sans:
```ts
fontFamily: {
  display: ['Nunito Sans', 'system-ui', 'sans-serif'],
  sans: ['Nunito Sans', 'system-ui', 'sans-serif'],
}
```

This means every existing `font-display` class (used on headings across Landing, Dashboard, Mastery, etc.) automatically picks up Nunito Sans — no component edits needed.

### 3. Adjust heading styles in `index.css`
Headings currently use `Fraunces` with `letter-spacing: -0.01em`. For Nunito Sans we'll:
- Drop the serif fallback
- Tighten weight to `font-weight: 700`
- Keep the slight negative tracking (looks good on Nunito Sans too)

### 4. Generate the mockup
Once the font swap is in place:
1. Take a `browser--screenshot` of the Dashboard (route `/app`) — the page you're already on
2. Run the product-shot script with the **`peach`** preset (warm, complements your existing terracotta accent + paper background)
3. Save to `/mnt/documents/standardstrack-nunito-mockup.png` and surface it as an artifact

You can then compare against the current look and either keep Nunito Sans or have me try one of the other three options.

## What stays the same

- All colors, spacing, layout, components — unchanged
- Terracotta accent, deep navy primary, warm paper background — unchanged
- No content or copy edits

## Reversibility

If you don't like Nunito Sans after seeing the mockup, reverting is a 3-line change (swap the Google Fonts link + the two `fontFamily` entries back). I can also do a quick A/B by generating mockups in 2 fonts side by side if you'd prefer that before committing.