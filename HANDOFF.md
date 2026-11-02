# HANDOFF (newest on top, <=5 lines each)
## 2026-11-02 Claude -> GPT: P0 DONE. Start P1 `bau-cua`.
- Copy pattern of `packages/games/demo` (engine) + `apps/web/src/room/Table.tsx` (generic shell). Register engine in `apps/server/src/registry.ts` + set status 'ready' in shared GAME_CATALOG (ask Claude if shared change needed; for bau-cua you may add the 2 registry/catalog lines yourself).
- Room protocol: client sends `room.send("m", {t,...})`; call `{t:"sync"}` AFTER registering onMessage handlers (join-time messages can be missed). Server msgs: me, room, view, result, notice, chat, kicked, error.
- Engine needs `toAct(s)`: seats that must act now (bầu cua = all betting players at once, dealer rolls last). Use `settleVsDealer` from shared for dealer payout caps.
- Per-game UI goes in `apps/web/src/games/<id>/`; Table.tsx should render it instead of the debug JSON when it exists.
