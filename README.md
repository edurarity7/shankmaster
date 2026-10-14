# Shankmaster

1v1 knife-only arena game in the browser, built portrait-first (9:16) for phones, also playable on desktop. Three.js, no build step.

Run locally: `python3 devserver.py 8643` then open http://localhost:8643

- `js/game.js` — rounds, movement physics (jump, dash, sprint, jump pads), combat, pickups, radar ping
- `js/npcs.js` — street life: traffic through the tunnel (cars, cabs, police, bus, cyclists), pedestrians/police who panic, dogs
- `js/bot.js` — AI opponent ("brain"); a future network brain plugs into the same interface
- `js/map.js` — London map, parkour props, 2.5D collision
- `js/characters.js` — cel-shaded characters with modular drip
- `js/knives.js` / `js/textures.js` — HD knife models, inspect tricks (butterfly/flip), procedural + animated skins, ShankTrak
- `js/emblems.js` — knife rank emblems
- `js/menu.js` — lobby stage (character on podium)
- `js/reveal.js` — supply-case opening (tap to power up → latches/smoke/blast → reel → knife reveal)
- `js/post.js` — bloom + colour grade
- `js/ui.js` — lobby tabs, locker, shop, quests, rank, HUD, results
- `js/audio.js` — synthesised SFX and voice grunts
- `js/data.js` — items, drip, quests, levels, profile (localStorage)

Install on iPhone: open the site in Safari → Share → Add to Home Screen (runs fullscreen).
