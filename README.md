# Plane Sight

Everything flying over Germantown, Maryland, in plain sight: a live night map of the aircraft around the house. It shows each flight's route (IAD → ORD), the aircraft type, altitude and speed, how close it will pass to home, and a log of everything that passed within 5 nm. Military aircraft get their own tracking within 250 nm.

## How the live data flows

```
browser (any device)                          Vercel functions (this repo's api/ folder)
────────────────────                          ──────────────────────────────────────────
GET /api/planes  every 10 s while you're      adsb.lol, 30 nm around home
  using it (20 s when it's just sitting       (falls back to airplanes.live, then adsb.fi)
  open, 60 s in a background tab)  ───────▶
GET /api/military  every 60 s     ───────▶    adsb.lol /v2/mil, kept to 250 nm around home
                  ◀───────────────────────    compact JSON rows

routes and aircraft details come straight from adsb.lol's route files and adsbdb,
looked up by the page itself and kept in the browser for 12 hours
draws the map 60× a second, moving each plane along its heading between updates
```

The flight feeds don't allow web pages to call them directly, so the two small functions in `api/` fetch for the page. They do nothing else, so each call is short. The CDN keeps each answer for 8 seconds, so every screen with the same home shares one fetch.

**What it costs to run:** nothing. The site runs on Vercel's free Hobby plan and uses no Claude tokens. It only runs while a page is open. One screen left open all day and night makes about 6,000 short function calls a day, inside the free monthly allowance (1 million calls, 360 GB-hours of memory, 4 hours of CPU).

**Privacy:** the page sends your home to its own functions rounded to two decimals (about half a mile). The exact spot stays in your browser.

## Using it

- **Zoom:** pinch, scroll, double-tap, or the 5, 10, 25 and 250 nm buttons. Zoom goes from the 250 nm military area down to street level, where streets, street names, buildings and house numbers appear. At 250 nm ordinary traffic shrinks to small marks so military aircraft stand out.
- **Move:** drag the map. Dragging stops following a plane; the target button recenters on home.
- **Tiles at the top:** In view steps through the planes near you, Nearest centers and follows the closest one, Military steps through military aircraft (using the Military tab's filter) and follows each, Passes opens today's log.
- **Closest military:** the button on the map always jumps to the nearest military aircraft and follows it.
- **Set home:** press and hold on your house (right-click on a computer) and tap Set home. Or open Change home and use your location, search an address (the search puts the pin on the house itself when OpenStreetMap knows the house number, otherwise uses U.S. Census Bureau address data), or drag the crosshair and tap Use map center. Saved in that browser only, so set it once per device.
- **Private home link:** opening the site as `…/#home=LAT,LON,Name` sets home on a device that doesn't have one yet; `#sethome=` replaces it. The part after `#` never leaves the browser and is removed from the address bar once read, so the public site never shows anyone's house.

**On a phone** the map fills the screen. The title, stats and controls float on it, a small card shows the plane you picked, and the details and lists are below: scroll down or tap "Details and lists".

## On your phone

Open the site in Safari, tap Share → **Add to Home Screen**. It opens full screen like an app, with its own icon.

## Put it online (free, about 5 minutes)

1. Go to **vercel.com** and sign up with your GitHub account.
2. Click **Add New… → Project**, find **flight-radar** and click **Import**.
3. Leave every setting as it is and click **Deploy**.

Vercel gives you an address like `flight-radar-joshdhill.vercel.app`. Every push to `main` redeploys automatically. Anyone with the address can open the page; the home pin it centers on is Germantown in general, and a home you set is saved only in your own browser.

## Military tracking

**The flyby card.** When a military aircraft is about to pass within 3.5 nm of home (or is already within 3 nm), a big card slides up over the map: an illustration of the aircraft crossing a night sky, the branch that flies it, what the aircraft is, what that kind of flight usually is, and a live countdown to its closest point. "Track on map" follows it. A pair flying together shows as "Flight of 2". Each aircraft gets the card once every 45 minutes. In a background tab, the page sends a notification instead (turn on "Alert me" in the Military tab), then shows the card when you come back. Any military aircraft can be opened by hand with "Open briefing" on its card. A soft chime can be switched on in the card.

**Who flies it.** The branch comes from the aircraft registry (adsbdb's registered owner) when it knows the airframe. Otherwise it's worked out from the callsign (PAT is Army, SAM and RCH are Air Force, CNV is Navy, C plus four digits is the Coast Guard), the tail-number format (Army and Air Force use fiscal-year serials like 13-20636, the Navy and Marines six-digit Bureau Numbers, the Coast Guard four digits) and the aircraft type. The notes live in `app/milinfo.js`.

Also:

- **Detection** uses three signals: the military flag in the aircraft database that adsb.lol publishes, the US military block of transponder addresses (AE0000–AFFFFF), and well-known military callsigns.
- **The Military tab** lists every military aircraft broadcasting within 250 nm, nearest first, with model and branch. Search by callsign, aircraft or branch, or filter: Coming my way (headed within 10 nm of home, soonest first), Helicopters, or one branch. Tap one to jump the map to it.
- **Passes** keeps every flight that came within 5 nm, with a "Military only" filter. Military passes keep the branch and model.
- **Map edge arrows** point to military aircraft outside the current view, with their distance.
- **Emergency squawks** (7500, 7600, 7700) get a pulsing red ring and a badge.

What no public feed can show: aircraft with their transponders off, and many fighters on training flights. In a formation, often only the lead aircraft broadcasts. Aircraft that send only Mode S (no position) appear when enough receivers hear them to compute a position by multilateration ("MLAT position" on the card).

## The Claude dashboard version

The same map also runs as a Claude dashboard. A Claude dashboard can't call outside servers, so it uses a different transport (`app/transport-claude.js`): on your PC it borrows the Claude desktop app's built-in browser to load adsb.lol and adsbdb, and saves each update to the dashboard's own store so your phone sees it live. Build it with:

```
node tools/build-claude.mjs
```

That writes `dist/claude-dashboard.html`, which Claude publishes as the dashboard. Optional flags: `--home "lat,lon,Name"` sets the dashboard's home (kept out of this public repo), and `--wide wide.json` adds a coarse map covering the 250 nm military area.

The dashboard uses no Claude tokens either: its feed requests are plain tool calls to the desktop app's browser, with no model involved. It runs only while it's open in the Claude desktop app (every 9 s, or every 30 s in the background).

## Data and credits

- Flights: [adsb.lol](https://adsb.lol) (ODbL), with [airplanes.live](https://airplanes.live) and [adsb.fi](https://adsb.fi) as fallbacks
- Routes: adsb.lol's route files (from [Virtual Radar Server standing data](https://github.com/vradarserver/standing-data)) and [adsbdb](https://www.adsbdb.com)
- Map: © OpenStreetMap contributors, via [OpenFreeMap](https://openfreemap.org) vector tiles (loaded live on the website; built into the Claude dashboard)

## Plane images

See [`sprites/README.md`](sprites/README.md) to swap the built-in map drawings and the flyby card's illustrations for your own images.

## Files

```
index.html          the page
app/style.css       look and layout
app/core.js         flight math: positions, closest approach, passes, aircraft classes
app/sprites.js      plane drawings for the map, and image overrides
app/milinfo.js      military notes: branch, aircraft, what a callsign means
app/milart.js       side-view illustrations for the flyby card
app/flyby.js        the military flyby card
app/basemap-tiles.js     live OpenFreeMap vector tiles for the website's map
app/ui.js           map drawing and panels
app/transport-web.js     website data: this site's /api functions, routes and adsbdb details
app/transport-claude.js  Claude dashboard data: the desktop app's browser + a shared store
api/planes.js       live aircraft near home
api/military.js     military aircraft within 250 nm
api/_lib.js         shared fetch, fallback, military detection
data/map.json       built-in detailed map around Germantown (used by the Claude dashboard)
sprites/            optional plane images
icons/, manifest.webmanifest   home-screen icon and app settings
tools/build-claude.mjs         builds the Claude dashboard version
```
