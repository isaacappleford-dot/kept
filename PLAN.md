# Kept — build plan

A free, installable, fully on-device PWA that turns receipts into reminders:
capture once, get a card, get reminded at the right moment, pull up proof in one tap.

The app name lives in **`src/config/app.ts`**. Store policies, warranty lengths and
the reminder schedule live in **`src/config/policies.ts`**.

## Principles

- Static site, no backend, no accounts, no analytics, no third-party requests at
  runtime. The OCR engine, model and PDF reader are served from our own origin.
- Pure, unit-tested TypeScript for every decision (date maths, receipt parsing,
  quick-add parsing, policy suggestions, deadlines, reminder stages, search,
  calendar/CSV/PDF writers). React and browser APIs only glue those together.
- Suggestions, never silent decisions: every suggested date shows where it came
  from and can be edited; every scan goes through “Check these details”.
- Feature-detect everything (notifications, badges, Web Share, persistent storage,
  createImageBitmap, WASM SIMD).
- iOS memory discipline: images are downscaled (≤2200 px for OCR, ≤1800 px saved),
  canvases released after use.

## Architecture

```
src/
  config/app.ts            name, colours, storage keys            ← rename here
  config/policies.ts       store windows, categories, reminder leads ← tune here
  lib/                     dates (pure), money (pure), store, router, toast, platform
  data/                    types, Dexie DB, hooks, draft store, search, savings, backup
  scan/                    PURE: parseDate, parseReceipt, quickAdd, toDraft, pixels
                           glue: image (decode/prepare), ocr (Tesseract), pdf (pdf.js), pipeline
  deadlines/               PURE: policy suggestions, deadlines, reminders
                           glue: notify (notifications, badge)
  export/                  PURE: ics, csv, pdfWriter; glue: documents, share, actions
  demo/                    generated sample receipt + sample cards
  screens/                 Onboarding, Home (Coming Up), Scan, Review, Card, Edit,
                           Wallet, Receipts, Savings, Settings, Privacy, Credits
  components/              ui kit, tab bar, rows, card form, amount sheet
public/
  ocr/                     Tesseract worker + LSTM WASM cores + eng model (copied at build)
  sw-notifications.js      notification click → open the card (imported by the SW)
tests/e2e/                 Playwright smoke tests
```

### Data flow

```
camera / photo ─► decode (EXIF upright) ─► save JPEG + thumb
                               └► grey + contrast stretch ─► Tesseract (WASM) ─► text
PDF ─► pdf.js text layer ─► text;  page 1 render ─► photo
sentence ─► quickAdd parser
text ─► parseReceipt ─► draft ─► + suggested Return by / Warranty ─► Review ─► IndexedDB
cards ─► deadlines() ─► Coming Up · reminders (notify on open, badge) · .ics export
```

### Key decisions

- **Native camera via `<input capture>`** rather than a live viewfinder: best
  photo quality on every phone, focus/flash handled by the OS, nothing to keep alive.
- **Tesseract LSTM “best_int” English model (~3 MB)**, precached; the WASM engine for
  the device’s CPU features (~4 MB) is cached on first use.
- **pdf.js legacy build**, lazy-loaded only when a PDF is picked (iOS 16 support).
- **Hand-written PDF writer** (Helvetica + JPEG) for receipt and inventory exports
  instead of a PDF library.
- **Calendar as the reliable reminder channel**: web apps can’t schedule local
  notifications, and push would require sending deadlines to a server.
- **Dates as `YYYY-MM-DD` strings** with arithmetic on UTC day numbers: deadlines
  are whole days, so no time-zone or DST bugs.
- **Hash routing** so GitHub Pages needs no rewrite and Android back works.
- **Tailwind v3** (v4 needs Safari 16.4+; we support iOS 16.0+).

## Version mapping from the concept

1. **Version 1 (done):** scan, check details, card with return and warranty dates,
   reminders, search, coupons as cards.
2. **Version 2 (done):** Wallet with balances, Savings, badge (instead of a widget),
   quick add, PDF export, inventory export, backups.
3. **Version 3 (not possible / later):** location alerts (no background location on
   the web), email import (would need a server), family sharing (would need sync).
   Android Web Share Target for screenshots/PDFs could be added with an
   `injectManifest` service worker.

Each change ends with `npm run check` (typecheck, lint, unit tests, build) and `npm run test:e2e`.
