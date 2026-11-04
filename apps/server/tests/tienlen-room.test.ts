import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client, type Room } from "colyseus.js";
import { createGameServer } from "../src/index";

// Needs registry.ts to contain the tien-len-nam / tien-len-bac engines.
const PORT = 25996;
let srv: ReturnType<typeof createGameServer>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { srv = createGameServer(PORT); await srv.listen(); });
afterAll(async () => { await srv.gameServer.gracefullyShutdown(false).catch(() => {}); });

describe.each(["tien-len-nam", "tien-len-bac"])("%s through TableRoom", (gameId) => {
  it("human + 3 bots finish a hand; payouts zero-sum; others' cards hidden", async () => {
    const room: Room = await new Client(`ws://localhost:${PORT}`).create("table", { gameId, guestName: "H", baseBet: 100 });
    const last: Record<string, any> = {};
    const views: any[] = [];
    for (const t of ["room", "view", "result", "error", "notice", "me"]) room.onMessage(t, (m: any) => { last[t] = m; if (t === "view") views.push(m); });
    const send = (t: string, x: object = {}) => room.send("m", { t, ...x });
    const until = async (fn: () => boolean, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(15); } throw new Error("timeout " + JSON.stringify(last).slice(0, 300)); };
    send("sync"); await until(() => !!last.room);
    for (let i = 1; i <= 3; i++) { send("addBot"); await until(() => last.room.seats.filter(Boolean).length === i + 1); }
    send("start");
    const end = Date.now() + 20000;
    while (!last.result && Date.now() < end) {
      const v = last.view;
      if (v && v.toAct.includes(v.seat) && !v.view.over) {
        last.view = null;
        const view = v.view;
        let a: any;
        if (view.canPass) a = { type: "pass" };
        else {
          const must = view.mustInclude;
          const card = must ? view.hand.find((c: any) => c.rank === must.rank && c.suit === must.suit) : view.hand[0];
          a = { type: "play", cards: [card] };
        }
        send("action", { a });
      }
      await sleep(25);
    }
    expect(last.result).toBeTruthy();
    expect(last.result.payouts.reduce((a: number, p: any) => a + p.delta, 0)).toBe(0);
    const mid = views.find((v) => !v.view.over);
    if (mid) { expect(mid.view.hands).toBeNull(); expect(mid.view.hand.length).toBeGreaterThan(0); }
    await room.leave();
  });
});
