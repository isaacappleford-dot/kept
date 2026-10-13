# Kept

A free, installable web app (PWA) for iPhone and Android that turns receipts into reminders. Snap a receipt once, and never miss a return window, warranty or coupon again.

- **100 % free.** No accounts, paywall, ads, in‑app purchases or analytics.
- **Private.** Receipts are read and stored on the phone. After the app loads it makes no requests to other servers. The text recogniser (Tesseract WASM), its English model and the PDF reader are all self‑hosted.
- **Static.** No backend, so it can be hosted for $0 on GitHub Pages, Vercel or Netlify.

> **Renaming:** the name lives in [`src/config/app.ts`](src/config/app.ts). The UI, the HTML `<title>` and the PWA manifest all read it from there.
> Store return windows and warranty lengths live in [`src/config/policies.ts`](src/config/policies.ts), along with the reminder schedule.

Architecture and how the concept maps to a web app are in [PLAN.md](PLAN.md). The manual test plan is in [docs/QA.md](docs/QA.md).

## Features

- **Capture, four ways in:** scan a paper receipt with the camera; pick a screenshot, photo or PDF of an online order (PDF text is read exactly, no OCR needed); **Quick add** a sentence such as *“Got a vacuum at Target, 90‑day return”* (type it or use the keyboard’s dictation mic); or type it in. Coupons, gift cards and store‑credit slips scan the same way.
- **On‑device reading:** each photo is greyscaled and contrast‑stretched, then read by Tesseract (LSTM, WASM, SIMD where available). A parser pulls out the store, date, items, prices, total, and for wallet items the value, code and expiry.
- **“Check these details”:** every scan lands on a review screen; anything the parser wasn’t sure of is marked **Check**.
- **Every purchase becomes a card:** store, date, items, price, the receipt photo, a **Return by** date suggested from the store’s usual policy (electronics windows and holiday extensions included), a **Warranty until** date suggested by category, an optional extended warranty, and notes (serial number, gift recipient, where the box is).
- **Online orders:** the return clock starts at delivery, and the app asks for the delivery date.
- **Coming Up (home):** every deadline sorted by urgency: This week (red), This month, Later, and Just missed.
- **Reminders:** “3 days left to return the boots ($120)”, “Your laptop warranty ends in 30 days. Anything acting up?”, “Your $10 coupon at Kohl’s expires Friday”. See [Reminders](#reminders).
- **Wallet:** coupons, gift cards and store credit grouped by store with balances; “Spent some”, “Used it all”, “I used it”. Tap a store for its **store page**: everything you have there, with coupon codes and photos shown big for the cashier.
- **Trials & subscriptions:** “Netflix trial ends Friday $15.49” or “Costco membership renews in March” and Kept reminds you 3 days and 1 day before it charges. “I cancelled it” counts toward Savings.
- **Finish the return:** “Return it” → in store, or by mail with the return label/QR saved and shown full screen at drop-off → “Dropped it off” → a check 10 days later that the refund arrived.
- **Price-drop money back:** for bigger buys at stores that usually refund a lower price (Target 14 days, Costco 30, Best Buy during the return window, Home Depot, Lowe’s, Kohl’s, Gap…), a reminder to check, a link to the store’s search, and “Got money back” for Savings.
- **Memberships & cards:** Target Circle Card, My Best Buy Plus/Total and REI Co-op lengthen return windows; a credit card that extends warranties fills in the longer date.
- **Sunday check-in and fewer reminders:** one 9 am note on Sundays with what to decide; everything due at once is bundled into one notification; no reminders for groceries (grocery-store receipts included) or buys under a cut-off.
- **Receipts:** a searchable archive (“TV”, “Best Buy”, part of a serial number, anything on the receipt) with filters.
- **Savings:** a running total of money kept through returns, price drops, warranty claims, coupons and cancelled trials.
- **Instant proof:** export any receipt as a PDF (details + photo) for a warranty claim or expense report; export an “everything I own” list as PDF or CSV for insurance.
- **Backups:** save and restore a backup file (iCloud Drive, Files, Google Drive…), since data lives only on the device.
- **PWA:** offline after the first load (scanning included), installable (Android prompt, iPhone how‑to), safe‑area aware, Reduce Motion and screen‑reader friendly.
- **Try it without receipts:** a generated **Sample receipt** goes through the real camera → OCR → review path, and **Add sample cards** fills every screen.

## Reminders

With the free reminders server (`server/`, a Cloudflare Worker) set up, reminders arrive at **9 am on the day, even when Kept is closed**. Each phone subscribes with its own private push address and sends only its own upcoming reminders, so everyone gets their own. Without it, reminders show when the app is opened. **Add to Calendar** works either way. iPhone needs Kept on the Home Screen (iOS 16.4+) for any notifications.

**One-time setup (free):**
1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com), open **Workers & Pages** once, and pick a `workers.dev` name when asked.
2. Go to **My Profile → API Tokens → Create Token**, use the **Edit Cloudflare Workers** template, and copy the token.
3. In this GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Cloudflare dashboard's right side).
4. Run the **Deploy to GitHub Pages** workflow. It deploys the server and builds the app pointed at it.

The server stores each phone's push address and its upcoming reminder text and times, nothing else. The free plan easily covers thousands of people.

## Run locally

Requirements: Node 20+ (CI uses 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` first runs `scripts/copy-assets.mjs`, which copies the Tesseract worker, its WASM engines and the English model from `node_modules` into `public/ocr/`.

No receipts handy? **Scan → Sample receipt**, or **Settings → Add sample cards**.

| Command | What it does |
| --- | --- |
| `npm run check` | typecheck + lint + unit tests + production build |
| `npm test` | Vitest unit tests (receipt and quick‑add parsing, dates, policies, deadlines, reminders, calendar/CSV/PDF export…) |
| `npm run build` / `npm run preview` | production build in `dist/` and a local server for it |
| `npm run test:e2e` | Playwright smoke tests against the build, including real OCR of the sample receipt (`npx playwright install chromium` first if you don’t have it) |
| `npm run icons` | regenerate PNG icons from `src/assets/logo.svg` |

## Test on a real phone (HTTPS required)

The camera picker works over plain HTTP on most phones, but installing, offline mode and notifications need `https://`.

1. **Deploy and open the real URL (recommended).** Push to `main` and open the GitHub Pages URL on your phone.
2. **Self‑signed HTTPS on your Wi‑Fi.** `npm run dev:https`, then open `https://<your-computer's-LAN-IP>:5173` on the phone (same Wi‑Fi) and accept the certificate warning. The service worker won’t register with a self‑signed certificate.
3. **An HTTPS tunnel** to `npm run dev`, for example `npx cloudflared tunnel --url http://localhost:5173`.

## Deploy to GitHub Pages (free)

The workflow `.github/workflows/deploy.yml` runs on every push to `main`: it installs, typechecks, lints, tests, builds with the right base path and deploys.

**Turn on one repo setting:** **Settings → Pages → Build and deployment → Source: “GitHub Actions”**.

The site will be at `https://<user>.github.io/<repo>/`. Routing is hash‑based, so no 404 rewrite is needed.

- **Vercel / Netlify:** import the repo; `vercel.json` / `netlify.toml` set `npm run build` → `dist`. Leave `BASE_PATH` unset.
- **Anything static:** `npm run build` and upload `dist/` (use `BASE_PATH=/sub/path/ npm run build` for a sub‑path).

## Privacy

There’s no server. Reading, parsing, reminders and exports all run in the browser. Data is stored in this browser’s IndexedDB on this device; clearing browser data, deleting the Home Screen app, or (on iPhone) leaving the app unused for weeks can erase it, so the app nudges you to save a backup. The Playwright smoke tests fail if the app requests any other origin.

## How the concept maps to a web app

| Concept (native iPhone) | Kept (PWA) |
| --- | --- |
| Apple document scanner | The phone’s own camera via the file picker, then contrast clean‑up |
| On‑device text recognition (Vision) | Tesseract WASM, self‑hosted, on‑device |
| iCloud storage & sync | IndexedDB on the device + backup/restore files |
| Local notifications | Push reminders from a free server, app badge, calendar alarms |
| Share an online order to the app | Pick a screenshot or PDF (Android’s share target needs extra work; see PLAN.md) |
| Voice quick‑add | Quick add sentence parser; dictate with the keyboard mic |
| Home screen widget | App icon badge (widgets aren’t available to web apps) |
| Location alerts (v3) | Not possible without background location on the web |
| Free + Premium ($2.99/mo) | Everything free, like Thirds |

## Known web limitations

- No automatic edge detection/perspective correction; shoot the receipt flat and fill the frame.
- No background location, so no “you’re near Target” alerts.
- No cross‑device sync; use backup files.
