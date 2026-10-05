# Mohalla. — Your neighbourhood, one tap away

A local business search app (like JustDial) built as a college project. It shows **real businesses near you**
from OpenStreetMap, plus listings that business owners add themselves.

## Run it

Needs **Node.js 22+** (uses the built-in SQLite database — nothing else to install).

```bash
npm run setup      # install packages (first time only)
npm run build      # build the website
npm run seed       # reset demo data (run this before every demo — live statuses expire after 12 h)
npm start          # open http://localhost:5000
```

For development with hot reload, run `npm run dev:server` and `npm run dev:client` in two terminals and open http://localhost:5173.

## Live demo / hosting

The whole app (API + website) runs as one Node server, so it can be hosted for free on [Render](https://render.com):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ANSHUL-REAL/mohalla)

`render.yaml` sets it up: it builds the website, seeds fresh demo data and starts the server on every deploy.
(On the free plan the server sleeps when idle, so the first visit can take ~1 minute to wake it up.)

The Android app (`Mohalla.apk`), presentation and demo videos are on the
[Releases page](https://github.com/ANSHUL-REAL/mohalla/releases).

## Android app

`Mohalla.apk` (in this folder) is the Android app. Its screens are inside the APK; listings come from the
laptop running `npm start`, so **the phone and laptop must be on the same Wi-Fi** (or connect the laptop to
the phone's hotspot; college Wi-Fi often blocks devices from talking to each other).

1. Run `npm start` on the laptop. It prints the address to use, e.g. `On your phone: http://192.168.1.7:5000`.
2. Copy `Mohalla.apk` to the phone and install it (allow "Install unknown apps" when asked).
3. Open Mohalla. If the laptop's address has changed, the app shows **Connect to server**: type the address
   printed in step 1. You can change it later from the "Server settings" link on the Login / Account page.

To rebuild the APK after changing the code (needs JDK 17 and the Android SDK):

```bash
cd client
npm run android     # builds the app bundle, syncs it and runs Gradle
```

The result is `client/android/app/build/outputs/apk/debug/app-debug.apk`. The default server address baked
into the APK is in `client/.env.app`. App icon and splash screen are drawn by `python tools/make_icons.py`.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@mohalla.test | admin123 |
| Business owner | owner@mohalla.test | owner123 |
| Customer | user@mohalla.test | user123 |

## Features

**Like JustDial**
- Search by keyword, category, city, or **near me** (GPS) with suggestions as you type
- Filter chips: Top Rated, Verified, Quick Response, Open Now, 4.0+, distance (1/3/5 km); sort by relevance, rating, reviews, distance
- Business cards with rating box, badges (Verified, Top Search, Trending, Quick Response, years in business),
  smart timings ("Open until 9 PM", "Opens at 9 AM tomorrow"), **Show Number**, WhatsApp, Send Enquiry
- Business page: photos, services, timings, map, directions, share, save, ratings breakdown, reviews
- "Get the list of top plumbers" form — one requirement goes to the 5 best-rated businesses
- Business owners: register, add/edit listings, upload photos, pick location on a map, see enquiries
- Admin: approve/feature/verify listings, manage users and categories, stats charts
- List and map view (OpenStreetMap)

**What makes Mohalla different from JustDial**
1. **Real nearby businesses** — turn on location and the app loads real shops, clinics, ATMs, restaurants around you from OpenStreetMap (free, no API key).
   Search any name (e.g. a college) and, if it isn't saved yet, it is looked up live on OpenStreetMap.
   Real places show their **real photo** (Wikimedia/Wikidata) or a **satellite view of their exact location** — never a fake stock photo
2. **No-spam Privacy Mode** — send an enquiry without revealing your number; businesses reply in an in-app chat
3. **Live Status** — owners tap *Available now / Busy / Closed today*, shown live on their listing
4. **Smart Ask** — type a normal sentence like *"my AC is not cooling, need someone urgently"* and it picks the category, open-now and nearest filters automatically (English + Hinglish words)
5. **Emergency mode** — one tap shows the nearest hospitals, pharmacies and ATMs with directions, plus helpline numbers
6. **Walking time** next to nearby places, and **claim this business** for real listings
7. If nobody is open right now, results fall back to the nearest places with their next opening time instead of an empty page

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19 + Vite, React Router, Leaflet maps, Lucide icons |
| Backend | Node.js + Express 5, REST API, JWT login, bcrypt password hashing, Multer photo uploads |
| Database | SQLite (built into Node.js) |
| Real data | OpenStreetMap Overpass API + Nominatim |

## Project structure

```
server/   index.js (API routes) · db.js (tables) · seed.js (demo data) · osm.js (real nearby businesses)
client/   src/pages (screens) · src/components · src/smartAsk.js · src/config.js (app name)
tools/    fetch_images.py (downloads the category photos)
```

To rename the app, edit `client/src/config.js`.

## Credits

Map and business data © OpenStreetMap contributors (ODbL). Category photos are Creative Commons images from Openverse —
full list on the in-app **Photo & data credits** page (`client/public/img/credits.json`).
Sample listings with "Shop No." addresses and their phone numbers are generated demo data.
