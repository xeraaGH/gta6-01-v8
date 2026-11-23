[![Make.fun — Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/xeraaGH/gta6-01-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/xeraaGH/gta6-01-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Bahía Azul — Make GTA 6

A complete 3D open-world crime game built for make.fun's
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).
Referral code: **mk5wvbzz** — https://make.fun/r/mk5wvbzz

## The game

Bahía Azul is a sun-bleached coastal city on the edge of the bay — six
districts, a beach, a pier and a lighthouse, and a crew trying to take it
back from the Vipers gang.

**The story.** Lucía "Luz" Vega came home to find her brother's crew wiped
out. Marcus "Mack" Kane drives like the devil and owes everybody. Together
they run ten story missions across the city — heists, deliveries, turf
fights and a final showdown — while the Bahía Azul PD escalates from a
single cruiser to roadblocks and a spotlight helicopter.

**Two leads, two abilities (press Q to switch).** Luz has Focus: five
seconds of slow motion for perfect shots. Mack has Nitro: a burst of speed
that turns any getaway into a headline.

**The city.** Old Harbor, La Plaza, North Beach, The Docks, University Hill
and Palm Heights — each with its own look and a standing score that grows
as you work it. Textured facades with varied rooflines, streetlights, palms,
billboards, a plaza fountain, a working pier and a lighthouse. Day and night
cycle with sun, moon, clouds, fog and lit windows after dark; weather rolls
in over the water.

**Driving and the law.** Third-person on foot, arcade car driving with a
chase camera — steal any car on the street. Traffic and pedestrians live
their own lives. Wanted levels 1–5: cruisers chase and PIT you, roadblocks
seal streets at 3 stars, a helicopter with a spotlight hunts you at 4+.
Break line of sight to cool off, or duck into the Pay 'n Spray in The
Docks for a fresh paint job and a clean slate.

**More to do.** Three street races, taxi fares, 20 hidden packages, combat
with pistol / SMG / rifle and fists, a crew system, district standing, a
live minimap, cash, health and armor, three procedural radio stations
(synthesized WebAudio — no audio files), and a localStorage save.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| Shift | Sprint |
| E | Enter / exit a car |
| Click | Shoot (aim at screen centre) |
| V | Punch |
| 1 / 2 / 3 | Pistol / SMG / rifle |
| M | Start the next story mission |
| N | Start a street race |
| T | Start a taxi fare |
| Q | Switch lead (Luz / Mack) |
| Space | Lead ability (Focus / Nitro) |
| G | Radio on / off (radio station cycles with the next press) |
| H | Horn |
| P / Esc | Pause |
| Drag mouse | Orbit the camera |

## Structure

```
game/
  index.html            the page (loads three.js, then the game)
  style.css             HUD + screens
  vendor/
    three.min.js        three.js r147, minified UMD build (vendored)
    THREE-LICENSE.txt   its MIT licence
  src/
    state.js            world data: districts, missions, races, leads
    city.js             the city: ground, buildings, props, sky, water, day/night
    vehicles.js         car models, arcade driving, traffic AI
    people.js           the player on foot, pedestrians
    police.js           wanted system, pursuit, roadblocks, helicopter
    missions.js         story missions, races, taxi, packages, save
    hud.js              HUD, live minimap, WebAudio engine + radio
    main.js             bootstrap, game loop, camera, combat, screens
main.ts                 copies game/ + screenshots/ to /output, writes dossier.json
screenshots/            four renders of the game running
```

## Build

```sh
node main.ts   # writes /output/dossier.json; run twice — the output is byte-identical
```

The game is pure static files — open `game/index.html` in a desktop browser
and it plays offline. No network requests at runtime; the only library is
the vendored minified three.js.
