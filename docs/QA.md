# Manual QA checklist

Test on real devices over HTTPS (the GitHub Pages URL is easiest). Tick each item on each target:
**iPhone Safari** (browser tab), **iPhone Home Screen app**, **Android Chrome**.

## First run
- [ ] Onboarding shows 3 screens; “Skip” works; “Turn on reminders” shows the notification prompt (iPhone: only from the Home Screen app; in Safari it explains Add to Home Screen).
- [ ] Empty Coming Up offers “Scan a receipt” and “Try it with sample cards”.

## Capture
- [ ] Scan a receipt opens the rear camera; the shot goes to “Reading the receipt…” then “Check these details” within ~5 s (first scan may take longer while the reader loads).
- [ ] A crumpled or faded receipt: unreadable fields are marked **Check**; nothing crashes.
- [ ] Screenshot of an emailed order: store/total/date read; “Bought online” is on and the delivery date is asked for.
- [ ] PDF receipt: text read exactly; page 1 becomes the receipt photo.
- [ ] HEIC photo from the iPhone library and a 48 MP photo both work (no crash, upright).
- [ ] Coupon / gift card / store credit scan lands as a wallet item with value, code and expiry.
- [ ] Quick add: “Got a vacuum at Target, 90-day return”, “$25 store credit at Target, expires Dec 31”, “Ordered boots on Amazon for $89, arrives Friday”. Dictation via the keyboard mic works.
- [ ] Sample receipt runs end to end offline (airplane mode after one full load).

## Review & cards
- [ ] Return by is suggested from the store (Target 90 days, electronics 30, holiday extension in Nov/Dec) with a one-line reason; editing it sticks; “Use suggestion” restores it.
- [ ] Changing the category updates the warranty suggestion.
- [ ] Card: I returned it (asks refund, adds to Savings), Keeping it (silences return reminders), Made a claim (adds to Savings), Undo for each.
- [ ] Receipt photo opens full screen; Export PDF shares a 2-page PDF (details + photo) that opens in Files/Preview.
- [ ] Add to Calendar opens the calendar import with the right all-day date and alerts.

## Coming Up, Wallet, Receipts, Savings
- [ ] Deadlines are grouped This week (red) / This month / Later / Just missed and sorted soonest first.
- [ ] Wallet groups by store with balances; “Spent some” lowers the balance; used/expired items are tucked away.
- [ ] Search finds by item, store, serial number and words on the receipt.
- [ ] Savings total and breakdown update; removing an entry asks first.

## Reminders
- [ ] With notifications on, a deadline 3 days out shows one notification on next open, not again on the next open.
- [ ] Tapping the notification opens that card.
- [ ] Badge shows this week’s count (Android Chrome installed; iPhone Home Screen app).

## Data & PWA
- [ ] Backup saves a .json; Restore on another browser/phone brings back cards, photos and savings.
- [ ] “Delete everything” asks first.
- [ ] Android: install prompt; iPhone: Add to Home Screen how-to; icon and status bar look right.
- [ ] Airplane mode after one full load: app opens, scanning (including OCR) works.
- [ ] VoiceOver/TalkBack: tabs, rows and buttons are labelled; toasts are announced.
