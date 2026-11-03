import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client, type Room } from "colyseus.js";
import { createGameServer } from "../src/index";

// Needs registry.ts to contain `"xi-dach": xiDachEngine`.
const PORT = 25998;
let srv: ReturnType<typeof createGameServer>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { srv = createGameServer(PORT); await srv.listen(); });
afterAll(async () => { await srv.gameServer.gracefullyShutdown(false).catch(() => {}); });

describe("xi-dach through TableRoom", () => {
  it("human + 2 bots play a full hand; zero-sum; hidden cards stay hidden", async () => {
    const room: Room = await new Client(`ws://localhost:${PORT}`).create("table", { gameId: "xi-dach", guestName: "H", baseBet: 100 });
    const last: Record<string, any> = {};
    const views: any[] = [];
    for (const t of ["room", "view", "result", "error"]) room.onMessage(t, (m: any) => { last[t] = m; if (t === "view") views.push(m); });
    const send = (t: string, x: object = {}) => room.send("m", { t, ...x });
    const until = async (fn: () => boolean, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(15); } throw new Error("timeout " + JSON.stringify(last).slice(0, 300)); };
    send("sync"); await until(() => !!last.room);
    send("addBot"); await until(() => last.room.seats.filter(Boolean).length === 2);
    send("addBot"); await until(() => last.room.seats.filter(Boolean).length === 3);
    send("setDealer", { seat: 1 }); await until(() => last.room.dealerSeat === 1);
    send("start");
    let acted = 0;
    const end = Date.now() + 15000;
    while (!last.result && Date.now() < end) {
      const v = last.view;
      if (v?.toAct?.includes(0) && !v.view.cats) {
        const a = v.view.canStand ? { type: "stand" } : { type: "hit" };
        last.view = null; acted++;
        send("action", { a });
      }
      await sleep(30);
    }
    expect(last.result).toBeTruthy();
    expect(last.result.payouts.reduce((a: number, p: any) => a + p.delta, 0)).toBe(0);
    expect(acted).toBeGreaterThan(0);
    // before the end, other seats' hands were hidden
    const mid = views.find((v) => v.view.phase !== "over");
    if (mid) { expect(mid.view.hands[1]).toBeNull(); expect(mid.view.hands[2]).toBeNull(); expect(mid.view.hands[0]).not.toBeNull(); }
    await room.leave();
  });
});
