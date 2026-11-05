import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client, type Room } from "colyseus.js";
import { createGameServer } from "../src/index";

// Needs registry.ts to contain `"bai-cao-to": baiCaoToEngine`.
const PORT = 25995;
let srv: ReturnType<typeof createGameServer>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { srv = createGameServer(PORT); await srv.listen(); });
afterAll(async () => { await srv.gameServer.gracefullyShutdown(false).catch(() => {}); });

describe("bai-cao-to through TableRoom", () => {
  it("human + 2 bots play a hand; zero-sum; opponents' cards never sent before showdown", async () => {
    const room: Room = await new Client(`ws://localhost:${PORT}`).create("table", { gameId: "bai-cao-to", guestName: "H", baseBet: 100 });
    const last: Record<string, any> = {};
    const views: any[] = [];
    for (const t of ["room", "view", "result", "error", "notice", "me"]) room.onMessage(t, (m: any) => { last[t] = m; if (t === "view") views.push(m); });
    const send = (t: string, x: object = {}) => room.send("m", { t, ...x });
    const until = async (fn: () => boolean, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(15); } throw new Error("timeout " + JSON.stringify(last).slice(0, 300)); };
    send("sync"); await until(() => !!last.room);
    for (let i = 1; i <= 2; i++) { send("addBot"); await until(() => last.room.seats.filter(Boolean).length === i + 1); }
    send("start");
    const end = Date.now() + 15000;
    while (!last.result && Date.now() < end) {
      const v = last.view;
      if (v && v.toAct.includes(v.seat) && !v.view.over) {
        last.view = null;
        send("action", { a: v.view.canCheck ? { type: "check" } : { type: "call" } });
      }
      await sleep(25);
    }
    expect(last.result).toBeTruthy();
    expect(last.result.payouts.reduce((a: number, p: any) => a + p.delta, 0)).toBe(0);
    for (const v of views.filter((x) => !x.view.over)) expect(v.view.hands).toBeNull();
    await room.leave();
  });
});
