# Shankmaster

1v1 knife-only arena game in the browser, built portrait-first (9:16) for phones, also playable on desktop. Three.js, no build step.

Run locally: `python3 devserver.py 8643` then open http://localhost:8643

- `js/game.js` — rounds, movement physics (jump, dash, sprint, jump pads), combat, pickups, bot AI
- `js/map.js` — London map, parkour props, 2.5D collision
- `js/characters.js` — cel-shaded characters with modular drip
- `js/knives.js` / `js/textures.js` — knife models + procedural skins
- `js/menu.js` — lobby stage (character on podium)
- `js/reveal.js` — chest opening (tap to power up → reel → knife reveal)
- `js/post.js` — bloom + colour grade
- `js/ui.js` — lobby tabs, locker, shop, quests, rank, HUD, results
- `js/audio.js` — synthesised SFX and voice grunts
- `js/data.js` — items, drip, quests, levels, profile (localStorage)
