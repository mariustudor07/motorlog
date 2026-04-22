# Motorlog 🚗

A free, clean Android app for UK vehicle owners. Track your MOT, road tax, and insurance across multiple vehicles — all in one place.

---

## Download

Head to the [Releases](../../releases) page to download the latest APK.

> **Install note:** You'll need to enable *Install from unknown sources* on your Android device before installing the APK directly.

---

## Features

- **Vehicle tracking** — Look up any UK vehicle instantly using the DVLA API, or add details manually
- **Smart reminders** — Configurable notifications at your chosen thresholds (default: 90 days amber, 30 days red)
- **MOT, Tax & Insurance** — Track all three expiry dates with colour-coded status badges
- **Calendar view** — See all upcoming events on a monthly calendar with colour-coded dots
- **Quick Check** — Look up any registration plate without saving it, just like totalcarcheck.com
- **Ask Mike** — Built-in AI mechanic powered by Google Gemini. Ask anything about your car
- **Fully offline storage** — All your vehicle data is stored locally on your device using SQLite

---

## Screenshots

> *(Add screenshots here)*

---

## Built With

- [Expo](https://expo.dev) / React Native
- [DVLA Vehicle Enquiry Service API](https://developer-portal.driver-vehicle-licensing.api.gov.uk)
- [Google Gemini](https://ai.google.dev) — AI mechanic assistant
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — Local database
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) — Scheduled reminders
- [react-native-calendars](https://github.com/wix/react-native-calendars) — Calendar view
- [@gorhom/bottom-sheet](https://gorhom.dev/react-native-bottom-sheet/) — Add vehicle sheet

---

## Setup (Developers)

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- A free [DVLA API key](https://developer-portal.driver-vehicle-licensing.api.gov.uk)
- A free [Google AI Studio key](https://aistudio.google.com/app/apikey) (Gemini)

### Installation

```bash
git clone https://github.com/mariustudor07/motorlog.git
cd motorlog
npm install --legacy-peer-deps
```

### Configuration

Create a `.env` file in the root directory:

```env
DVLA_API_KEY=your_dvla_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### Run

```bash
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/client) on your Android device.

### Build APK

```bash
eas build -p android --profile preview
```

---

## Roadmap

- [ ] Play Store release
- [ ] Home screen widget
- [ ] Service history log per vehicle
- [ ] Mileage tracker
- [ ] Share vehicles with family/partner

---

## License

MIT — free to use and modify.
