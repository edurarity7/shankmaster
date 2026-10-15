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

## Online play

- Transport: Supabase Realtime (WebSocket relay) — `js/netconfig.js` holds the project URL + publishable key. Only Realtime channels are used (no tables), so pointing at a different Supabase project is just changing those two values.
- Matchmaking (`js/net.js`): players join the `shankmaster-lobby-v1` presence channel; waiting players are paired oldest-first, the lower id invites, the other accepts, both move to a private `sm-m-<id>` channel. After `searchSeconds` with nobody around, you get an AI opponent instead.
- In a match (`js/game.js`): each client simulates its own fighter and sends a snapshot 20×/s; the opponent is rendered ~110 ms in the past with interpolation. The attacker detects hits on their screen and sends `hit`; the victim applies damage to themselves and announces `dead`. The host owns rounds (`round` with spawns + a shared seed for pickups/traffic) and time-outs (`rend`). `bye`/presence leave/7 s silence = the other player wins.
- Bump `protocol` / `lobby` in `netconfig.js` whenever the netcode changes so old and new clients don't get paired.
- Test: open the game in two browser windows (or two phones) and press PLAY on both within ~20 s.
