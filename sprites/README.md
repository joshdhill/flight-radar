# Plane images

The map draws each aircraft as a small built-in drawing. You can replace those drawings with your own images, either for a whole class of aircraft or for one exact aircraft type.

## Image spec

- **Top-down view, nose pointing straight up.** The page rotates the image to the aircraft's heading.
- **Transparent PNG, 256 × 256 px.** Center the aircraft, and have it fill about 80% of the height.
- **No shadow, glow or background.** The page adds a soft glow under each plane in its altitude color.
- Helicopters and the V-22 can include their rotor blades.
- Keep the same lighting and angle across the set so they look like a family.

## By class (9 images)

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
