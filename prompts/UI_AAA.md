# UI/UX/Audio overhaul — "market-quality casino card game" (Codex = owner of apps/web)

Goal: owner says the current UI is OK but crude. Target the feel of top mobile/web card games (Zing Play / iWin / Big Win class): rich felt tables, real-looking cards, juicy animation, layered sound, instant readability on a phone in landscape AND a big desktop screen. Realistic for web: polished 2D/2.5D, 60 fps, no heavy downloads. Do NOT touch engines/server/shared (request changes in HANDOFF.md).

## Hard rules
- Never write source files via PowerShell here-strings/echo (they eat "@"); use your editor tool. After CSS/JS edits run `pnpm dev` and confirm the page loads with no Vite error overlay.
- No copyrighted assets or real brand designs. Make cards/icons as SVG/CSS/canvas in code. Any external asset must be CC0 with licence in ASSETS.md.
- One commit per task (`git add . && git commit`), do NOT push. Keep `pnpm test` and `pnpm typecheck` green. Update PROJECT_MAP.txt with every new file.
- Reply only `DONE: ... | TESTS: ... | NEXT: ... | BLOCKER: ...` after each task.

## T1 — Design system (apps/web/src/ui/)
- Tokens: deep green felt gradient + subtle noise, warm gold accents (#f5c451 family), glass panels, soft shadows, rounded 16–24px, readable Vietnamese font stack (system + "Be Vietnam Pro" via local fallback; no CDN needed).
- `Card` (SVG): crisp standard 52-card face (corner indices, pips, proper J/Q/K look made with simple vector art), elegant card back pattern, sizes sm/md/lg, `faceDown`, `selected` (lift), `dim`, `highlight` glow. Smooth 3D flip (CSS rotateY, preserve-3d).
- `ChipStack`/`Chip` (denominations coloured, stacks with shadow), `Avatar` (initial/emoji, frame, turn countdown RING, dealer 🏦/host 👑/bot 🤖 badges, chip count with count-up), `TableFelt` (oval table with rim/wood, vignette, centre logo), `Button` (primary gold, secondary glass, disabled, pressed state, ≥44px touch), `Toast`, `Modal`.
- Seat layout engine: place N seats around an oval (me at bottom), responsive: desktop = big table; phone landscape = compact (opponents on top/sides, hand tray at bottom); portrait = vertical-stacked fallback.

## T2 — Audio (apps/web/src/audio/) — synthesize with WebAudio, zero downloaded files
- `sound.ts`: single `AudioContext`, unlocked on first user gesture; `play(name)`; master/SFX/music volumes + mute persisted in localStorage; ducking when tab hidden.
- Procedural SFX (layered noise bursts + filtered oscillators + envelopes): `dealCard`, `flipCard`, `placeCard`, `shuffle`, `chipBet`, `chipPile`, `chipWin`, `turnPing`, `timerTick` (last 5 s), `pass`, `chop` (heavy hit for chặt), `win` (bright arpeggio), `lose` (soft descending), `jackpot`/`baiThangTrang` (fanfare), `buttonClick`, `notify`, `error`.
- Optional ambient bed: soft synthesized lounge loop (very quiet, off by default toggle "Nhạc nền").
- Settings popover (🔊): sliders + mute, visible in every table HUD and the lobby.
- Haptics: `navigator.vibrate` short patterns on my turn / win (respect a "Rung" toggle).

## T3 — Motion
- Use Framer Motion (+ small canvas particle layer). Deal: cards fly from a deck at table centre to each seat with stagger and slight rotation; flip on reveal; played cards slide to the centre pile; chips fly from pot to winner; win burst (confetti/sparkle particles, gold rays) and number count-up for chips; turn timer ring depletes; pulse on the active seat; subtle idle breathing on the table light.
- Respect `prefers-reduced-motion` (fade only). Keep 60 fps on a mid phone: transform/opacity only, no layout thrash.

## T4 — Re-skin every game on the new kit
Order: bau-cua (dice shake animation + big tile board), xi-dach, tien-len (fan hand with drag-select & sort buttons; show last play in centre; chặt flash), bai-cao, bai-cao-to (raise slider, pot, reveal), baccarat (+ "Bỏ lượt" button). Common HUD: room code (tap to copy), rules ("Hướng dẫn"), sound ⚙, leave, my chips; result overlay with +/- chips per seat and "Ván mới" for host. Reuse the same components; no per-game duplicates of Card/Chip/Avatar.

## T5 — Lobby + shell
Hero banner, illustrated game tiles (vector icons per game, hover/press animation, player-count + "có cái" tags, "Hướng dẫn" ⓘ), quick-play "Chơi với máy" button (creates room + auto-adds bots), friends/online + chat panel (collapsible; bottom sheet on phone), top bar with avatar, chips, settings. Name screen: nicer logo + tagline.

## T6 — Mobile/PWA polish
Safe-area insets, landscape-first, no accidental zoom/scroll, large touch targets, wake lock during a hand, `manifest.webmanifest` + icons (generated SVG→PNG) so it can be "added to home screen".

## Acceptance
- A new player can start a vs-bots game in ≤3 taps; every action has visual + sound feedback; nothing overlaps on 360×640 landscape and 1920×1080; Lighthouse performance ≥ 80 on mobile preset; all tests green.
