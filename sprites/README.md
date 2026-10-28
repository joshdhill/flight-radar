# Plane images

The map draws each aircraft as a small built-in drawing. You can replace those drawings with your own images, either for a whole class of aircraft or for one exact aircraft type.

## Image spec

- **Top-down view, nose pointing straight up.** The page rotates the image to the aircraft's heading.
- **Transparent PNG, 256 × 256 px.** Center the aircraft, and have it fill about 80% of the height.
- **No shadow, glow or background.** The page adds a soft glow under each plane in its altitude color.
- Helicopters and the V-22 can include their rotor blades.
- Keep the same lighting and angle across the set so they look like a family.

## By class (10 images)

Put these in this folder and list them under `classes` in `manifest.json`:

| File | Used for |
|---|---|
| `narrow.png` | 737, A320 family, 757, A220 |
| `wide.png` | 767, 777, 787, A330, A350, 747, A380 |
| `regional.png` | CRJ, Embraer E-jets and ERJs, Dash 8, ATR |
| `bizjet.png` | Citation, Gulfstream, Challenger, Global, Phenom, Learjet, Falcon |
| `prop.png` | Cessna, Piper, Cirrus, King Air, PC-12 |
| `heli.png` | All helicopters, including Black Hawks and Coast Guard Dolphins |
| `fighter.png` | F-16, F-15, F/A-18, F-35, F-22, A-10, T-38, T-6 |
| `miltransport.png` | C-17, C-5, C-130, KC-135, KC-46, E-3, E-6, P-8 |
| `tiltrotor.png` | V-22 Osprey |
| `drone.png` | RQ-4 Global Hawk, MQ-9 Reaper, U-2 |

## By exact type (optional)

For a specific model, name the file with its ICAO type code, put it in `sprites/types/`, and list the code under `types`. A type image wins over a class image.

```
sprites/types/B738.png   Boeing 737-800
sprites/types/H60.png    Black Hawk
sprites/types/C17.png    C-17
```

## manifest.json

The page only loads images listed here, so the browser doesn't ask for files that don't exist:

```json
{
  "classes": ["narrow", "wide", "heli"],
  "types": ["B738", "H60"]
}
```

## Flyby illustrations (the big military card)

When a military aircraft passes close, Plane Sight shows a large card with a side-view illustration of it crossing a night sky. Built-in drawings cover every family of aircraft. A painted image replaces the drawing for that type.

**Spec**

- **Side view, nose pointing right**, level flight. The page flips it automatically when the aircraft is flying west.
- **Transparent PNG, 1280 × 520 px** (the card shows it at about 620 × 250). Keep the aircraft inside the middle 85%, with the rotor tips of helicopters inside the frame.
- **No background, no ground shadow.** The card supplies the sky, clouds and a soft drop shadow.
- Paint it the way that branch flies it around here (olive-drab Army Black Hawks, the Air Force's blue-and-white Hueys, red-orange Coast Guard Dolphins, white-and-blue VIP jets). Don't include real squadron emblems or tail numbers.
- Same light direction (from the upper left) across the set.

Name each file with the ICAO type code, put it in `sprites/hero/`, and list the code under `hero` in `manifest.json`:

```
sprites/hero/H60.png    UH-60 Black Hawk (the most common one over Germantown)
sprites/hero/B212.png   UH-1N Twin Huey (Air Force, Joint Base Andrews)
sprites/hero/AS65.png   MH-65 Dolphin (Coast Guard)
sprites/hero/C17.png    C-17 Globemaster III
sprites/hero/C5M.png    C-5M Super Galaxy
sprites/hero/K35R.png   KC-135 Stratotanker
sprites/hero/C30J.png   C-130J Super Hercules
sprites/hero/V22.png    V-22 Osprey
sprites/hero/B752.png   C-32 (Air Force Two's 757)
sprites/hero/GLF5.png   C-37 Gulfstream
sprites/hero/BE20.png   C-12 Huron
sprites/hero/H64.png    AH-64 Apache
sprites/hero/H47.png    CH-47 Chinook
sprites/hero/F16.png    F-16 Fighting Falcon
```

You can also name a file after a drawing family instead of a type (`heli-utility`, `heli-huey`, `heli-light`, `heli-attack`, `heli-tandem`, `tiltrotor`, `airlifter`, `turboprop`, `tanker`, `jet`, `bizjet`, `twinprop`, `fighter`, `drone`), and it's used for every type in that family that has no image of its own.

```json
{
  "classes": [],
  "types": [],
  "hero": ["H60", "B212", "AS65"]
}
```

The Claude dashboard can't load image files, so it always uses the built-in drawings.
