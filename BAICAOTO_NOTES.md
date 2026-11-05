# Bài cào tố drop — notes for Codex (delete when done)

## 1. Already copied by owner (do NOT edit engine)
NEW `packages/games/bai-cao-to/**` (engine + 12 tests), NEW `apps/server/tests/baicaoto-room.test.ts`.

## 2. Wiring you do
1. `apps/server/package.json` + `apps/web/package.json`: add `"@cg/game-bai-cao-to": "workspace:*"`; `pnpm install`.
2. `apps/server/src/registry.ts`: import `baiCaoToEngine` from `@cg/game-bai-cao-to`, add `"bai-cao-to": baiCaoToEngine`.
3. `packages/shared/src/types.ts` GAME_CATALOG: `bai-cao-to` → `status: "ready"` (status only).
4. `RulesModal.tsx`: add `baiCaoToEngine.rulesText`.
5. UI `apps/web/src/games/bai-cao-to/BaiCaoToTable.tsx` (plug into Table.tsx like other games). View = `BCTView`:
   - `myHand` (3 cards, face-up only for me; others face-down), `myInfo.label` ("8 điểm"/"Ba tây"), `order`, `current`, `committed[seat]` chips each seat has put in, `pot`, `currentBet`, `toCall`, `minRaiseTo`, `maxRaiseTo`, `canCheck/canCall/canRaise`, `folded`, `raisesLeft`, `over`, `showdown`, `hands`/`infos` (non-folded players' cards + labels, ONLY at showdown), `winners`.
   - Actions: `send("action",{a:{type:"fold"}})`, `{type:"check"}`, `{type:"call"}`, `{type:"raise",to:<total amount>}`. Raise = slider/quick buttons (min, ½, max) between `minRaiseTo` and `maxRaiseTo`; show "Theo {toCall}", "Tố lên {to}", "Qua", "Úp bài". Server returns `error` text on invalid.
   - Show: pot with chip stack, each seat's committed chips in front of them, folded seats greyed, turn highlight + timer (`view.deadline`), "lật bài" reveal animation at showdown, winners highlighted with payout from `result.payouts`.
6. `pnpm test` must pass. PROJECT_MAP.txt: bai-cao-to row → engine DONE (Claude), UI row. Append block below to RULES_DECISIONS.md.

## 3. Append to RULES_DECISIONS.md
### Bài cào tố (defaults by Claude, owner to approve; flags in `rulesFlags`)
- 2–8 players, 3 cards, no dealer. Ante = base bet. One betting round: check / call / raise / fold, ends when all remaining players have matched; then showdown.
- Points = sum of 3 cards mod 10 (A=1, 10/J/Q/K = 10). Ba tây (J,Q,K) highest. Tie → highest card (K>Q>J>10>…>A, suit ♥>♦>♣>♠); flag `tieBreakByCard=false` splits the pot.
- Max raises per hand 4 (flag `maxRaises`). Total bet per player capped at the smallest stack at the table → no side pots, nobody can be short.
- Last player standing wins without showing cards. Human timeout: check if free, else fold.
