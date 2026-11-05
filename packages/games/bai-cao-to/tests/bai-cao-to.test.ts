import { describe, expect, it } from "vitest";
import { seededRng, type Card, type Suit } from "@cg/shared";
import { baiCaoToEngine as e, handInfo, type BCTAction, type BCTState } from "../src";

const R: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
const H = (...c: string[]): Card[] => c.map((x) => ({ rank: R[x.slice(0, -1)] ?? Number(x.slice(0, -1)), suit: x.slice(-1) as Suit }));
const info = (n: number, chips = 10_000) => Array.from({ length: n }, (_, i) => ({ seat: i, id: "u" + i, name: "P" + i, isBot: false, chips }));

/** fixed hands, seat 0 to act, ante 100 each */
function st(hands: Record<number, Card[]>, over: Partial<BCTState> = {}): BCTState {
  const seats = Object.keys(hands).map(Number);
  const base = e.init({ seats: info(seats.length), baseBet: 100, rng: seededRng(1), flags: {} });
  return { ...base, seats, hands, committed: Object.fromEntries(seats.map((x) => [x, 100])), current: 0, ...over };
}
const ok = (r: any): BCTState => { if ("error" in r) throw new Error(r.error); return r.state; };
const act = (s: BCTState, seat: number, a: BCTAction) => e.apply(s, seat, a);

describe("hand maths", () => {
  it("points, ba tây", () => {
    expect(handInfo(H("5S", "6H", "7D"))).toMatchObject({ points: 8, baTay: false, label: "8 điểm" });
    expect(handInfo(H("KS", "QH", "JD"))).toMatchObject({ baTay: true, label: "Ba tây" });
    expect(handInfo(H("10S", "KH", "QD")).points).toBe(0);
    expect(handInfo(H("AS", "AH", "AD")).points).toBe(3);
  });
});

describe("betting flow", () => {
  const hands = { 0: H("5S", "6H", "7D"), 1: H("9S", "KH", "10D"), 2: H("2S", "3H", "4D") };
  it("check around ends the round and shows down", () => {
    let s = st(hands);
    s = ok(act(s, 0, { type: "check" }));
    s = ok(act(s, 1, { type: "check" }));
    expect(s.over).toBe(false);
    s = ok(act(s, 2, { type: "check" }));
    expect(s.over).toBe(true);
    expect(s.showdown).toBe(true);
  });
  it("raise forces everyone else to respond", () => {
    let s = st(hands);
    s = ok(act(s, 0, { type: "raise", to: 300 }));
    expect(s.current).toBe(1);
    expect("error" in act(s, 1, { type: "check" })).toBe(true);
    s = ok(act(s, 1, { type: "call" }));
    s = ok(act(s, 2, { type: "call" }));
    expect(s.over).toBe(true);
    expect(s.committed).toEqual({ 0: 300, 1: 300, 2: 300 });
  });
  it("re-raise sends the action back around", () => {
    let s = st(hands);
    s = ok(act(s, 0, { type: "check" }));
    s = ok(act(s, 1, { type: "raise", to: 300 }));
    s = ok(act(s, 2, { type: "call" }));
    expect(s.current).toBe(0);
    s = ok(act(s, 0, { type: "call" }));
    expect(s.over).toBe(true);
  });
  it("enforces min raise, cap and max raise count", () => {
    let s = st(hands, { cap: 1000 });
    expect("error" in act(s, 0, { type: "raise", to: 100 })).toBe(true);
    expect("error" in act(s, 0, { type: "raise", to: 150 })).toBe(true); // min = 200
    expect("error" in act(s, 0, { type: "raise", to: 1001 })).toBe(true);
    expect("error" in act(s, 0, { type: "raise", to: 250.5 })).toBe(true);
    s = ok(act(s, 0, { type: "raise", to: 200 }));
    expect("error" in act(s, 1, { type: "raise", to: 250 })).toBe(true); // min = 300
    const capped = st(hands, { cap: 1000, flags: { maxRaises: 1, tieBreakByCard: true } });
    const r1 = ok(act(capped, 0, { type: "raise", to: 200 }));
    expect("error" in act(r1, 1, { type: "raise", to: 400 })).toBe(true);
  });
  it("everyone folds but one: winner takes pot without showdown", () => {
    let s = st(hands);
    s = ok(act(s, 0, { type: "raise", to: 400 }));
    s = ok(act(s, 1, { type: "fold" }));
    s = ok(act(s, 2, { type: "fold" }));
    expect(s.over).toBe(true);
    expect(s.showdown).toBe(false);
    const p = e.settle(s);
    expect(p.find((x) => x.seat === 0)!.delta).toBe(200);
    expect(p.find((x) => x.seat === 1)!.delta).toBe(-100);
    expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
    expect(e.view(s, 1).hands).toBeNull();
  });
  it("only the actor can act", () => {
    const s = st(hands);
    expect("error" in act(s, 1, { type: "check" })).toBe(true);
  });
});

describe("showdown", () => {
  it("higher points win; ba tây beats 9; ties broken by highest card", () => {
    const s1 = st({ 0: H("5S", "6H", "7D"), 1: H("KS", "QH", "JD"), 2: H("4S", "5H", "10D") }, { over: true, showdown: true });
    expect(e.view(s1, 0).winners).toEqual([1]);
    const tie = st({ 0: H("5S", "6H", "7D"), 1: H("4H", "7S", "7D") }, { over: true, showdown: true }); // both 8, 7D vs 7D? highest 7D vs 7D
    expect(e.view(tie, 0).winners!.length).toBeGreaterThanOrEqual(1);
    const tb = st({ 0: H("2S", "3H", "3D"), 1: H("AS", "2H", "5C") }, { over: true, showdown: true }); // 8 vs 8, highest 3D vs 5C -> seat1
    expect(e.view(tb, 0).winners).toEqual([1]);
    const split = st({ 0: H("2S", "3H", "3D"), 1: H("AS", "2H", "5C") }, { over: true, showdown: true, flags: { maxRaises: 4, tieBreakByCard: false } });
    expect(e.view(split, 0).winners).toEqual([0, 1]);
    const p = e.settle(split);
    expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
    expect(p.find((x) => x.seat === 0)!.delta).toBe(0);
  });
  it("odd pot splits without losing chips", () => {
    const s = st({ 0: H("2S", "3H", "3D"), 1: H("AS", "2H", "5C"), 2: H("4S", "4H", "10C") }, {
      over: true, showdown: true, committed: { 0: 101, 1: 101, 2: 101 }, flags: { maxRaises: 4, tieBreakByCard: false },
    });
    expect(e.settle(s).reduce((a, b) => a + b.delta, 0)).toBe(0);
  });
  it("hidden hands until showdown", () => {
    const s = st({ 0: H("5S", "6H", "7D"), 1: H("9S", "KH", "10D") });
    const v = e.view(s, 1);
    expect(v.hands).toBeNull();
    expect(v.myHand).toEqual(H("9S", "KH", "10D"));
    expect(v.canCheck).toBe(false); // not your turn
    const sd = ok(act(ok(act(s, 0, { type: "check" })), 1, { type: "check" }));
    expect(e.view(sd, 0).hands).not.toBeNull();
  });
});

describe("full games with bots", () => {
  it("always legal, terminates, zero-sum, committed within chips (2-8 seats)", () => {
    for (let seed = 0; seed < 400; seed++) {
      const n = 2 + (seed % 7);
      const rng = seededRng(seed + 7);
      const chips = seed % 3 === 0 ? 300 : 20_000;
      let s = e.init({ seats: info(n, chips), baseBet: 100, rng, flags: {} });
      let guard = 0;
      while (!e.isOver(s)) {
        if (++guard > 300) throw new Error("no termination " + seed);
        const seat = e.toAct(s)[0]!;
        const a = e.bot(s, seat, rng);
        const r = e.apply(s, seat, a);
        if ("error" in r) throw new Error(`seed ${seed}: ${r.error} ${JSON.stringify(a)}`);
        s = r.state;
      }
      const p = e.settle(s);
      expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
      for (const x of p) expect(x.delta).toBeGreaterThanOrEqual(-chips);
    }
  });
  it("timeoutAction and listed legalActions are always accepted", () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = e.init({ seats: info(4), baseBet: 100, rng: seededRng(seed), flags: {} });
      let guard = 0;
      while (!e.isOver(s) && guard++ < 100) {
        const seat = e.toAct(s)[0]!;
        for (const a of e.legalActions(s, seat)) expect("error" in e.apply(s, seat, a)).toBe(false);
        s = ok(e.apply(s, seat, e.timeoutAction!(s, seat)));
      }
      expect(e.isOver(s)).toBe(true);
    }
  });
});
