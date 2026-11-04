# SPEC — Card Game Web (single source of truth)
Both AIs MUST follow this file. If a rule is missing, ask the owner once; never invent silently.

## 0. Hard rules
- Virtual chips ONLY. No cash-in/cash-out, no real-money purchase, no gifting chips for money. Show "chơi giải trí, không dùng tiền thật".
- Shuffle/deal/RNG/settlement run on SERVER only. Client never receives hidden cards of others (send per-seat `view`).
- UI language: Vietnamese (i18n-ready keys). Code/comments: English.
- Owner is non-coder: every deliverable must run with copy-paste commands; no manual code edits needed.

## 1. Stack
- Monorepo pnpm: `apps/web`, `apps/server`, `packages/shared`, `packages/games/<id>`.
- Web: React + Vite + TypeScript + Tailwind + PixiJS (cards/table render) + Framer Motion. Responsive: one codebase, desktop = rich (full table, effects), mobile = compact layout (bottom hand tray, fewer effects). Landscape-first on mobile.
- Server: Node + TypeScript + Colyseus (rooms, lobby, reconnection).
- Auth/DB/friends/chips: Supabase (Google login + anonymous guest). Guest chips are local-profile only, reset allowed.
- Voice: LiveKit Cloud (free tier), push-to-talk + mute. Text chat: lobby room + per-table room via Colyseus.
- Hosting: web on GitHub Pages or Cloudflare Pages; server on Render/Fly free tier; CI GitHub Actions.
- Visual target: polished AAA-feel 2D/2.5D (smooth animation, particles, sound, haptics, felt textures). Use CC0/licensed or self-generated assets only; list every asset license in `ASSETS.md`.

## 2. Game engine contract (packages/games/<id>), pure TS, no I/O, deterministic with injected RNG
```ts
interface GameEngine<S, A, V> {
  meta: { houseBanked?: boolean /* virtual house: settle may be non-zero-sum (Baccarat) */; id: string; name: string; minPlayers: number; maxPlayers: number; hasDealer: boolean; rulesFlags: Record<string, boolean|number> };
  init(cfg: {seats: SeatInfo[]; dealerSeat?: number; baseBet: number; rng: RNG; flags: object}): S;
  legalActions(s: S, seat: number): A[];
  apply(s: S, seat: number, a: A): {state: S} | {error: string};
  view(s: S, seat: number): V;                 // hides other seats' hidden info
  toAct(s: S): number[];                          // seats that must act now (room auto-plays bots/timeouts)
  timeoutAction?(s: S, seat: number): A;           // safe default when a HUMAN times out (pass/stand); else bot() is used
  isOver(s: S): boolean;
  settle(s: S): {seat: number; delta: number}[]; // chips; dealer pays only what it has
  bot(s: S, seat: number, rng: RNG): A;          // must always return a legal action
  rulesText: string;                             // shown in "Hướng dẫn" button (Vietnamese)
}
```
Every engine ships with unit tests (vitest) incl. settle sums to zero and bots never illegal.

## 3. Games (build order)
1. `bau-cua` (dealer chosen pre-game; players bet on 6 tiles; 3 dice; dealer pays per match, pays what it has)
2. `xi-dach` (dealer; xì dách, xì bàng, ngũ linh, quắc >21; dealer needs ≥15 to stand)
3. `tien-len-nam`, `tien-len-bac` (2–4 players, no dealer; rule differences as flags: chặt heo, chặt chồng, tới trắng, thối hàng, cóng. Implementer must write chosen defaults into rulesText and list them in `RULES_DECISIONS.md` for owner approval)
4. `bai-cao` (3 cards, "bài điểm"; dealer; point = sum mod 10; 3 face cards = "ba tây" highest)
5. `bai-cao-to` (3 cards + betting rounds: bet/raise/call/fold until all remaining matched, then showdown; no dealer)
6. `baccarat` (no dealer choice; standard third-card rules; bets Player/Banker/Tie)
7. `poker` (Texas Hold'em, 2–9 seats, blinds, side pots; use `pokersolver` for hand ranking)
Each game: rulesText + "Hướng dẫn" button in lobby card and in-table.

## 4. Room/Lobby rules
- Wire protocol in `packages/shared/src/protocol.ts`: client `room.send("m",{t,...})`; call `{t:"sync"}` after registering handlers.
- Kick rule: after a hand, anyone with chips < baseBet is kicked; dealer below baseBet closes the room.
- Lobby: public chat, game cards, friends list (online status, invite), create room (game, base bet, seats, dealer pick), join by link or 6-char code.
- Dealer: chosen by host in the room BEFORE start (only games with hasDealer). Dealer pays winners up to its chips ("có bao nhiêu đền bấy nhiêu"). Dealer chips = 0 → broadcast "Nhà cái hết tiền", end hand, close room.
- Player chips = 0 after settle → kicked to lobby with notice.
- Bots: host can add bots to fill seats or play bots-only (solo). Bots labeled. Bots never get info they shouldn't.
- Disconnect: whole table pauses 15s with countdown + "X mất kết nối". Back in time → resume. Not back/left → bot finishes that hand, then kick with notice. Reconnect token via Colyseus `allowReconnection`.
- Turn timer per game (default 30s) → auto-action by bot.

## 5. Phases
- P0 scaffold: monorepo, shared types, engine contract, Colyseus room base (seat, ready, bots, pause/reconnect), Supabase auth stub, CI, deploy, `SETUP.md` for owner.
- P1 `bau-cua` end-to-end (engine+room+UI+rules) = reference implementation others copy.
- P2 `xi-dach`, `bai-cao`, `baccarat`. P3 `tien-len-*`. P4 `poker`, `bai-cao-to`. P5 friends, voice, lobby chat polish, effects/sound, mobile tuning.
- A phase is done only when: tests pass, `pnpm dev` runs, deployed preview works, `CHANGELOG.md` updated.

## 6. Task split
- Claude: P0 scaffold, server/room framework, engines for xi-dach, tien-len-*, poker, bai-cao-to, bot logic, code review of ChatGPT output.
- ChatGPT: web UI/animation/sound per game, bau-cua, baccarat, bai-cao engines+UI, lobby/friends UI, tests, asset pipeline.
- Boundary: ChatGPT never edits `packages/shared` or engine contract; request change via `HANDOFF.md`. Claude never edits `apps/web/src/games/*` UI without reason.

## 7. Working protocol (token-saving)
- FIRST read `PROJECT_MAP.txt` (file tree + notes) then HANDOFF.md. Any file add/remove/rename/role change → update PROJECT_MAP.txt in the same change (path, note, status, owner, date). A task isn't DONE until the map is current.
- Work silently. Output only: code/files + final line `DONE: <what> | TESTS: pass/fail | NEXT: <1 line> | BLOCKER: <or none>`.
- Small commits, one task each. Don't rewrite files unnecessarily; give diffs/patches or only changed files.
- Don't explain code unless asked. Don't repeat the spec. Ask at most ONE question, only if blocked.
- Cross-AI notes go in `HANDOFF.md` (append-only, newest on top, ≤5 lines each).
