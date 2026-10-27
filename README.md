# Plane Sight

Everything flying over Germantown, Maryland, in plain sight: a live night map of the aircraft around the house. It shows each flight's route (IAD → ORD), the aircraft type, altitude and speed, how close it will pass to home, and a log of everything that passed within 5 nm. Military aircraft get their own tracking within 250 nm.

## How the live data flows

```
browser (any device)                         Vercel functions (this repo's api/ folder)
────────────────────                         ──────────────────────────────────────────
every 10 s:  GET /api/planes      ────────▶  adsb.lol, 30 nm around home
                                             (falls back to airplanes.live, then adsb.fi)
                                             + routes (adsb.lol route files, adsbdb fallback),
                                               cached 6 h per callsign, shown only if the
                                               plane is actually along that route
every 60 s:  GET /api/military    ────────▶  adsb.lol /v2/mil, kept to 250 nm around home
             ◀──────────────────────────────  compact JSON rows
draws the map 60× a second, moving each plane
forward along its heading and speed between updates
```

The flight feeds don't allow web pages to call them directly, so the two small functions in `api/` fetch for the page. Each response is cached for a few seconds, so several screens share one upstream request.

## On your phone

Open the site in Safari, tap Share → **Add to Home Screen**. It opens full screen like an app, with its own icon.

## Put it online (free, about 5 minutes)

1. Go to **vercel.com** and sign up with your GitHub account.
2. Click **Add New… → Project**, find **flight-radar** and click **Import**.
3. Leave every setting as it is and click **Deploy**.

Vercel gives you an address like `flight-radar-joshdhill.vercel.app`. Every push to `main` redeploys automatically. Anyone with the address can open the page; the home pin it centers on is Germantown in general, and a pin you move is saved only in your own browser.

## Military tracking

What the page does:

- **Details:** tapping a military aircraft shows its operator (for example United States Army), the full model name and, when one exists, a photo of that exact airframe, all from adsbdb. Well-known callsigns are explained: SAM is a VIP Special Air Mission out of Andrews, RCH is Air Mobility Command, PAT is the Army's Priority Air Transport, C plus four digits is the Coast Guard.
- **Detection** uses three signals: the military flag in the aircraft database that adsb.lol publishes, the US military block of transponder addresses (AE0000–AFFFFF), and well-known military callsigns (RCH, SAM, PAT, CNV and others). The selected aircraft's card says which signal matched.
- **The Military tab** lists every military aircraft broadcasting within 250 nm, nearest first. Tap one to jump the map to it.
- **Map edge arrows** point to military aircraft outside the current view, with their distance.
- **Alerts:** the Military tab's "Alert me" switch sends a browser notification when a military aircraft comes within 15 nm of home. An on-page banner shows either way.
- **Emergency squawks** (7500, 7600, 7700) get a pulsing red ring and a badge.

What no public feed can show: aircraft with their transponders off, and many fighters on training flights. Aircraft that send only Mode S (no position) appear when enough receivers hear them to compute a position by multilateration ("MLAT position" on the card).

## The Claude dashboard version

The same map also runs as a Claude dashboard. A Claude dashboard can't call outside servers, so it uses a different transport (`app/transport-claude.js`): on your PC it borrows the Claude desktop app's built-in browser to load adsb.lol and adsbdb, and saves each update to the dashboard's own store so your phone sees it live. Build it with:

```
node tools/build-claude.mjs
```

That writes `dist/claude-dashboard.html`, which Claude publishes as the dashboard.

## Data and credits

- Flights: [adsb.lol](https://adsb.lol) (ODbL), with [airplanes.live](https://airplanes.live) and [adsb.fi](https://adsb.fi) as fallbacks
- Routes: adsb.lol's route files (from [Virtual Radar Server standing data](https://github.com/vradarserver/standing-data)) and [adsbdb](https://www.adsbdb.com)
- Map: © OpenStreetMap contributors, via OpenFreeMap vector tiles, baked into `data/map.json`

## Plane images

See [`sprites/README.md`](sprites/README.md) to swap the built-in plane drawings for your own images.

## Files

```
index.html          the page
app/style.css       look and layout
app/core.js         flight math: positions, closest approach, passes, aircraft classes
app/sprites.js      plane drawings and image overrides
app/ui.js           map drawing and panels
app/transport-web.js     website data: this site's /api functions + adsbdb details
app/transport-claude.js  Claude dashboard data: the desktop app's browser + a shared store
api/planes.js       live aircraft near home
api/military.js     military aircraft within 250 nm
api/_lib.js         shared fetch, fallback, military detection, routes
data/map.json       roads, water, woods and town names around Germantown
sprites/            optional plane images
icons/, manifest.webmanifest   home-screen icon and app settings
tools/build-claude.mjs         builds the Claude dashboard version
```
