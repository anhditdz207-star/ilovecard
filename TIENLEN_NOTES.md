# Tiến lên drop — notes for Codex (delete this file when done)

## 1. Files already copied by the owner (do NOT recreate/modify the engine)
- NEW `packages/games/tien-len/**` — ONE package that serves BOTH games: exports `tienLenNamEngine` (id `tien-len-nam`) and `tienLenBacEngine` (id `tien-len-bac`), plus `tienLenNamRules`, `tienLenBacRules`, `analyze`, `beats`, `cval`, types `TLView`, `TLAction`, `Combo`.
- CHANGED `packages/shared/src/settle.ts` (+ tests): added `settleNet`.
- NEW `apps/server/tests/tienlen-room.test.ts` (needs the wiring below).

## 2. Wiring you do
1. `apps/server/package.json` and `apps/web/package.json`: add `"@cg/game-tien-len": "workspace:*"`; run `pnpm install`.
2. `apps/server/src/registry.ts`: import `{ tienLenNamEngine, tienLenBacEngine } from "@cg/game-tien-len"`; add `"tien-len-nam": tienLenNamEngine`, `"tien-len-bac": tienLenBacEngine`.
3. `packages/shared/src/types.ts` GAME_CATALOG: set `tien-len-nam` and `tien-len-bac` to `status: "ready"` (status only).
4. `RulesModal.tsx`: add both rules texts (`tienLenNamRules`, `tienLenBacRules`).
5. UI `apps/web/src/games/tien-len/TienLenTable.tsx` (used for both ids), plugged into Table.tsx like the other games. View = `TLView`:
   - `hand` (own cards, already sorted low→high), `counts[seat]` others' card counts, `order` seats, `current` whose turn, `lead` = `{seat, cards, type}` last play on the table (or null = you lead), `passed` seats that passed this round, `finished` finishing order, `canPass`, `mustInclude` (card the first play must contain: show hint "Nước đầu phải có 3♠"), `over`, `white` (`{seat, kind}`; kind labels: rong = "Sảnh rồng", tuQuyHeo = "Tứ quý heo", sauDoi = "6 đôi" → show "Tới trắng!"), `hands` (everyone's leftover cards, only when over).
   - Interaction: click cards to select/deselect (raise selected cards), buttons "Đánh" and "Bỏ lượt". "Đánh" → `send("action",{a:{type:"play",cards:selected}})`, "Bỏ lượt" → `{type:"pass"}`. Enable "Đánh" only if it is your turn and `analyze(selected)` is not null (and, if `view.lead`, `beats(analyze(lead.cards), analyze(selected), {lastIsChop:false,chatChong:true})` as a soft hint only; the SERVER decides and returns `error` messages which must be shown near the hand).
   - Show: opponents (name, card count, 🏁 order badge, "Bỏ lượt" tag when in `passed`), table centre with `lead.cards` + owner name, turn highlight + timer from `view.deadline`, finishing medals 🥇🥈🥉, final payouts from `result.payouts`.
   - Animate: deal, play-to-centre, pass, chặt (flash on chặt heo), win.
6. `pnpm test` must pass (incl. `tienlen-room.test.ts`). Update PROJECT_MAP.txt: replace the two rows `tien-len-nam/`, `tien-len-bac/` with ONE row `packages/games/tien-len/ # Tiến lên Nam+Bắc, 1 engine 2 bộ cờ luật [DONE][CLAUDE]`; add UI row. Append block below to RULES_DECISIONS.md.

## 3. Append to RULES_DECISIONS.md
### Tiến lên (defaults chosen by Claude — owner to approve; flags in engine meta `rulesFlags`)
- 2–4 players, 13 cards each. Order 3<…<K<A<2, suits ♠<♣<♦<♥. First play must include the lowest dealt card (3♠). Play continues until one player is left (ranks 1..n).
- Chặt: tứ quý or 3 đôi thông beat a single 2; tứ quý or 4+ đôi thông beat a pair of 2s. Levels: 3 đôi thông < tứ quý < 4 đôi thông < 5 < 6.
- **Nam**: chặt chồng ON; money for chặt heo (black 2 = 1 bet, red 2 = 2 bets, paid by the 2's owner; with chặt chồng both the 2's owner and the chopped chopper pay the last chopper); cóng (never played) pays winner +2; thối heo (2s left in the last player's hand) pays winner; rank payouts 4p +3/+1/−1/−3, 3p +2/0/−2, 2p +1/−1 bets.
- **Bắc**: chặt chồng OFF; no chặt-money, no cóng, no thối; rank payouts only (same table).
- Tới trắng (instant win at deal): sảnh rồng (3→A), tứ quý heo, 6 đôi; each opponent pays 3 bets. Not implemented: 5 đôi thông tới trắng, tứ quý 3.
- Losers pay at most their chips; winners share what was collected (settleNet).
- Human timeout: pass if allowed, else play the lowest single.

## 4. Extra tasks for Codex (after the wiring, one commit each)
A. Baccarat UI: add a "Bỏ lượt" button → `send("action",{a:{type:"pass"}})` (engine now supports it).
B. UI polish pass (no engine/server edits): shared `Card` component with real-looking cards (SVG/CSS, ♠♣♦♥, face-down back), deal/flip/slide animation, chip stack animation, consistent theme tokens, sound hooks (no audio files required yet), desktop rich layout and compact mobile layout (landscape-friendly). Record any asset licences in ASSETS.md.
