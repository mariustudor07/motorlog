# Motorlog — Play Store Listing

## App details

| Field | Value |
|---|---|
| App name | Motorlog |
| Package | com.motorlog.app |
| Category | Auto & Vehicles |
| Content rating | Everyone |
| Price | Free |
| Contains ads | No |
| In-app purchases | No |

---

## Short description
*(80 characters max — shown in search results)*

```
MOT, tax & insurance reminders for UK drivers. DVLA-powered.
```

---

## Full description
*(4000 characters max)*

```
Motorlog is the complete vehicle management app built specifically for UK drivers.

Never miss an MOT, road tax renewal, or insurance expiry again. Add any UK-registered vehicle in seconds — Motorlog looks up your registration plate on the DVLA database and fills in the details automatically.

──────────────────────────────
REMINDERS THAT ACTUALLY WORK
──────────────────────────────
Get push notifications before your MOT, road tax, insurance, permits and other deadlines expire. Choose exactly how far in advance you want to be warned — 30 days, 14 days, 7 days — you decide.

The Upcoming tab shows every deadline across all your vehicles in one place, colour-coded by urgency. No more missed renewals.

──────────────────────────────
DVLA & DVSA INTEGRATION
──────────────────────────────
• Instant lookup by registration plate — no manual data entry
• Pull live MOT status, tax status, make, colour, and engine details from the DVLA
• Full MOT history including advisories and failure reasons from the DVSA
• Refresh any vehicle with one tap to get the latest data

──────────────────────────────
COMPLETE VEHICLE RECORDS
──────────────────────────────
• Service history — log every service, oil change, tyre replacement and repair with date, cost and mileage
• Fuel log — track every fill-up, calculate real MPG, and see your total fuel spend
• Mileage tracker — log odometer readings to monitor distance over time
• Vehicle notes — keep a scratchpad for each vehicle ("needs rear tyre sorting", "MOT station booked")

──────────────────────────────
COSTS & DEADLINES
──────────────────────────────
• Monthly payments — track car finance, monthly insurance instalments and road tax direct debits. See your total monthly spend per vehicle and get reminders before each payment
• Passes & permits — track Dart Charge accounts, M6 Toll passes, parking permits, ULEZ and Clean Air Zone exemptions, with expiry reminders

──────────────────────────────
ASK MIKE — AI ASSISTANT
──────────────────────────────
Got a question about a warning light? Wondering what actually fails an MOT? Ask Mike — your no-nonsense AI mechanic. Mike can see your saved vehicles and give advice specific to your car's make, fuel type and upcoming deadlines.

──────────────────────────────
EXPORT YOUR DATA
──────────────────────────────
Export service history, fuel logs, mileage records and more as CSV files. Useful for business mileage claims, selling a vehicle, or keeping records for a lease return.

──────────────────────────────
PRIVACY FIRST
──────────────────────────────
Your data is stored locally on your device. No account. No sign-up. No tracking. Motorlog never uploads your personal data to any server. The only external connections are to the UK government's DVLA and DVSA APIs — and only when you explicitly look something up.

──────────────────────────────
HGV & LORRY DRIVERS
──────────────────────────────
Enable Lorry Driver Mode in Settings to unlock HGV-specific check tracking — safety inspections (6-weekly), periodic inspections, tachograph calibrations and speed limiter checks. Set intervals, log completions and get reminders before each is due.

──────────────────────────────
QUICK CHECK
──────────────────────────────
Not sure about a car you're looking to buy? Use Quick Check to look up any UK registration plate instantly — get MOT status, tax status, and full MOT history without adding it to your garage.

──────────────────────────────

Motorlog is built for UK drivers, by UK drivers. Data comes directly from official UK government APIs (DVLA VES, DVSA MOT History).
```

---

## Keywords / tags
*(for ASO — weave into description naturally)*

```
MOT reminder, road tax reminder, UK car app, DVLA lookup, vehicle reminder,
car insurance reminder, MOT check, vehicle check, car service log,
fuel log, MPG tracker, HGV checks, tachograph reminder, UK vehicle,
car history, mot history, dvsa, dvla, vehicle management
```

---

## What's new (first release)
*(Release notes for Play Store)*

```
Initial release of Motorlog.

• Add any UK vehicle via registration plate — DVLA lookup included
• MOT, road tax and insurance reminders with push notifications
• Full DVSA MOT history
• Service history log, fuel log and mileage tracker
• Monthly payment tracking (finance, insurance instalments)
• Passes & permits tracker (Dart Charge, M6 Toll, parking permits)
• Ask Mike — AI car assistant
• Data export as CSV
• HGV mode for lorry drivers
• Privacy-first: all data stored on device, no account required
```

---

## Content rating questionnaire answers

| Question | Answer |
|---|---|
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Controlled substances | No |
| User-generated content | No |
| Personal/sensitive information collected | No (data stored on device only) |
| Location data | No |
| Financial information | No |
| Intended for children | No |

**Expected rating: Everyone**

---

## Data safety section (Play Console)

### Data collected
| Data type | Collected? | Notes |
|---|---|---|
| Name | No | — |
| Email | No | — |
| Location | No | — |
| Vehicle registration | Yes — not stored by us | Sent to DVLA/DVSA APIs on demand, not retained by Motorlog |
| Chat messages | Yes — not stored by us | Sent to Google Gemini only when Ask Mike is used |

### Data shared
| Third party | Data shared | Purpose |
|---|---|---|
| DVLA (UK Government) | Vehicle registration | Vehicle data lookup |
| DVSA (UK Government) | Vehicle registration | MOT history lookup |
| Google Gemini | Chat messages + optional vehicle summary | AI assistant |

### Storage
- All user data is stored locally on the user's device
- No data is transmitted to Motorlog servers (none exist)
- No data is retained after app uninstall

---

## Privacy policy URL

Host the contents of `PRIVACY_POLICY.md` at a public URL and paste it here.

Suggested options:
- GitHub Pages: `https://<yourusername>.github.io/motorlog/privacy`
- Raw GitHub: `https://raw.githubusercontent.com/<user>/motorlog/main/PRIVACY_POLICY.md`
- Notion public page, Google Sites, any static host

**This URL is required before you can publish on Google Play.**

---

## Screenshots required

Google Play requires at least 2 screenshots per device type.
Recommended: 4–8 screenshots, phone format (1080×1920 or similar).

Suggested screens to capture:
1. **My Vehicles** — home screen with a car or two added
2. **Vehicle Detail** — showing status badges (MOT green, Tax amber etc.)
3. **Upcoming tab** — showing reminders across vehicles
4. **Service History** — showing a few service records
5. **Fuel Log** — showing MPG stats strip
6. **Ask Mike** — showing a chat conversation
7. **Quick Check** — showing a DVLA result with MOT history expanded

**Feature graphic** (1024×500): Required. A banner image shown at the top of the Play listing.
Use a dark background (#0f172a) with the Motorlog name and a simple car/dashboard icon.

---

## Build & submit commands

```bash
# Make sure you're logged in
npx eas login

# Build production AAB for Play Store
npx eas build --platform android --profile production

# Submit to Play Store (after downloading from EAS dashboard)
npx eas submit --platform android --profile production

# Or submit a local AAB file
npx eas submit --platform android --path ./build.aab
```

**Before first submission:**
1. Create a Google Play Console account (one-time $25 fee)
2. Create the app listing manually in Play Console first
3. Upload the AAB to the Internal Testing track
4. Add yourself as a tester, install, and test on a real device
5. Once happy, promote to Production

---

## Checklist before submitting

- [ ] App icon 1024×1024 PNG uploaded in Play Console
- [ ] Feature graphic 1024×500 PNG uploaded
- [ ] At least 2 phone screenshots uploaded
- [ ] Short description written
- [ ] Full description written
- [ ] Privacy policy URL added and accessible
- [ ] Data safety section completed
- [ ] Content rating questionnaire completed
- [ ] Contact email added
- [ ] App category set to Auto & Vehicles
- [ ] Production AAB built with `eas build --profile production`
- [ ] AAB tested on a real Android device via Internal Testing
- [ ] `.env` file has real DVLA and Gemini API keys (not committed to git)
