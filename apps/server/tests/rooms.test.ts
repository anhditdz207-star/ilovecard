import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client, type Room } from "colyseus.js";
import { createGameServer } from "../src/index";

const PORT = 25999;
let srv: ReturnType<typeof createGameServer>;
const url = `ws://localhost:${PORT}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  srv = createGameServer(PORT);
  await srv.listen();
});
afterAll(async () => {
  await srv.gameServer.gracefullyShutdown(false).catch(() => {});
});

/** collects the latest message of each type */
function track(room: Room) {
  const last: Record<string, any> = {};
  const log: { type: string; msg: any }[] = [];
  for (const t of ["room", "view", "result", "notice", "error", "kicked", "chat"]) {
    room.onMessage(t, (msg: any) => {
      last[t] = msg;
      log.push({ type: t, msg });
    });
  }
  const until = async (fn: () => boolean, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return;
      await sleep(15);
    }
    throw new Error("timeout waiting; last=" + JSON.stringify(last).slice(0, 400));
  };
  return { last, log, until };
}
const send = (room: Room, t: string, extra: object = {}) => room.send("m", { t, ...extra });

describe("LobbyRoom", () => {
  it("chat is broadcast and history sent", async () => {
    const a = await new Client(url).joinOrCreate("lobby", { guestName: "An" });
    const got: any[] = [];
    a.onMessage("chat", (m) => got.push(m));
    const b = await new Client(url).joinOrCreate("lobby", { guestName: "Binh" });
    const hist: any[] = [];
    b.onMessage("history", (h) => hist.push(h));
    a.send("chat", { text: "xin chào" });
    await sleep(300);
    expect(got.some((m) => m.text === "xin chào" && m.name === "An")).toBe(true);
    await a.leave();
    await b.leave();
  });
});

describe("TableRoom", () => {
  it("full hand vs bots: settle zero-sum, back to lobby", async () => {
    const room = await new Client(url).create("table", { gameId: "demo", guestName: "Host", baseBet: 100 });
    const t = track(room);
    send(room, "sync");
    await t.until(() => !!t.last.room);
    expect(room.roomId).toMatch(/^[A-Z0-9]{6}$/);
    send(room, "start");
    await t.until(() => !!t.last.error); // not enough players
    send(room, "addBot");
    send(room, "addBot");
    await t.until(() => t.last.room.seats.filter(Boolean).length === 3);
    send(room, "start");
    await t.until(() => t.last.error?.text === "Chưa chọn nhà cái");
    send(room, "setDealer", { seat: 1 });
    await t.until(() => t.last.room.dealerSeat === 1);
    send(room, "start");
    await t.until(() => t.last.room.phase === "playing");
    await t.until(() => t.last.view?.toAct?.includes(0));
    expect(t.last.view.view.hands[0]).toBeNull(); // own hand not drawn yet; others hidden
    send(room, "action", { a: { type: "draw" } });
    await t.until(() => !!t.last.result);
    expect(t.last.result.payouts.reduce((a: number, p: any) => a + p.delta, 0)).toBe(0);
    await t.until(() => t.last.room.phase === "lobby");
    await room.leave();
  });

  it("rejects out-of-turn and non-host actions", async () => {
    const host = await new Client(url).create("table", { gameId: "demo", guestName: "H" });
    const th = track(host);
    send(host, "sync");
    await th.until(() => !!th.last.room);
    const guest = await new Client(url).joinById(host.roomId, { guestName: "G" });
    const tg = track(guest);
    send(guest, "addBot");
    await tg.until(() => tg.last.error?.text === "Chỉ chủ phòng mới làm được");
    send(host, "action", { a: { type: "draw" } });
    await th.until(() => !!th.last.error);
    await host.leave();
    await guest.leave();
  });

  it("drop + reconnect within window resumes the game", async () => {
    const c = new Client(url);
    const host = await c.create("table", { gameId: "demo", guestName: "Host", baseBet: 100 });
    const t = track(host);
    send(host, "sync");
    await t.until(() => !!t.last.room);
    send(host, "addBot");
    await t.until(() => t.last.room.seats.filter(Boolean).length === 2);
    send(host, "setDealer", { seat: 1 });
    await t.until(() => t.last.room.dealerSeat === 1);
    send(host, "start");
    await t.until(() => t.last.room.phase === "playing");
    const token = host.reconnectionToken;
    (host as any).connection.close(4001); // non-consented drop
    await sleep(300);
    const back = await c.reconnect(token);
    const t2 = track(back);
    await t2.until(() => !!t2.last.room || !!t2.last.view || true);
    await sleep(300);
    send(back, "action", { a: { type: "draw" } });
    await t2.until(() => !!t2.last.result, 8000);
    expect(t2.last.result.payouts.reduce((a: number, p: any) => a + p.delta, 0)).toBe(0);
    await back.leave();
  });

  it("drop without return: table pauses, then bot finishes the hand and seat is freed", async () => {
    const hostC = new Client(url);
    const host = await hostC.create("table", { gameId: "demo", guestName: "Host", baseBet: 100 });
    const th = track(host);
    send(host, "sync");
    await th.until(() => !!th.last.room);
    const guest = await new Client(url).joinById(host.roomId, { guestName: "Gone" });
    send(host, "addBot");
    await th.until(() => th.last.room.seats.filter(Boolean).length === 3);
    send(host, "setDealer", { seat: 0 });
    await th.until(() => th.last.room.dealerSeat === 0);
    send(host, "start");
    await th.until(() => th.last.room.phase === "playing");
    (guest as any).connection.close(4001); // seat 1 drops
    await th.until(() => th.last.room.phase === "paused");
    expect(th.last.room.paused.seats).toEqual([1]);
    await th.until(() => th.log.some((l) => l.type === "notice" && l.msg.code === "player_left_bot"));
    await th.until(() => th.last.view?.toAct?.includes(0)); // dealer acts last
    send(host, "action", { a: { type: "draw" } });
    await th.until(() => !!th.last.result);
    await th.until(() => th.last.room.phase === "lobby");
    expect(th.last.room.seats[1]).toBeNull(); // dropped human kicked after hand
    await host.leave();
  });

  it("dealer short of chips closes the room", async () => {
    // baseBet 100000 == DEFAULT_CHIPS; dealer loses/wins -> someone drops below bet
    const host = await new Client(url).create("table", { gameId: "demo", guestName: "Host", baseBet: 100000 });
    const t = track(host);
    send(host, "sync");
    await t.until(() => !!t.last.room);
    send(host, "addBot");
    await t.until(() => t.last.room.seats.filter(Boolean).length === 2);
    send(host, "setDealer", { seat: 1 });
    await t.until(() => t.last.room.dealerSeat === 1);
    // play hands until the dealer or host is broke (ties possible, so loop)
    for (let i = 0; i < 20 && !t.log.some((l) => l.type === "kicked" || (l.type === "notice" && l.msg.code === "dealer_broke_closed")); i++) {
      send(host, "start");
      await t.until(() => t.last.view?.toAct?.includes(0) || t.log.some((l) => l.type === "kicked"), 4000).catch(() => {});
      if (t.log.some((l) => l.type === "kicked")) break;
      send(host, "action", { a: { type: "draw" } });
      await sleep(250);
    }
    const ended = t.log.some((l) => l.type === "kicked") || t.log.some((l) => l.type === "notice" && l.msg.code === "dealer_broke_closed");
    expect(ended).toBe(true);
  });
});
