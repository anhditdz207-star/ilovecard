import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client, type Room } from "colyseus.js";
import { createGameServer } from "../src/index";

const PORT = 25997;
let srv: ReturnType<typeof createGameServer>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
beforeAll(async () => { srv = createGameServer(PORT); await srv.listen(); });
afterAll(async () => { await srv.gameServer.gracefullyShutdown(false).catch(() => {}); });

describe("baccarat (house-banked) through TableRoom", () => {
  it("settles without zero-sum abort and credits chips", async () => {
    const room: Room = await new Client(`ws://localhost:${PORT}`).create("table", { gameId: "baccarat", guestName: "B", baseBet: 100 });
    const last: Record<string, any> = {};
    for (const t of ["room", "view", "result", "error"]) room.onMessage(t, (m: any) => { last[t] = m; });
    const send = (t: string, x: object = {}) => room.send("m", { t, ...x });
    const until = async (fn: () => boolean, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await sleep(15); } throw new Error("timeout " + JSON.stringify(last).slice(0, 300)); };
    send("sync"); await until(() => !!last.room);
    send("start"); await until(() => last.room.phase === "playing");
    await until(() => last.view?.toAct?.includes(0));
    send("action", { a: { type: "bet", side: "player", amount: 100 } });
    await until(() => !!last.result);
    const me = last.result.payouts.find((p: any) => p.seat === 0);
    expect(me).toBeTruthy();
    await until(() => last.room.phase === "lobby");
    expect(last.room.seats[0].chips).toBe(100000 + me.delta);
    await room.leave();
  });
});
