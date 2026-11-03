import { describe, expect, it } from "vitest";
import { seededRng, type Card, type Suit } from "@cg/shared";
import { xiDachEngine as e, normalize, points, categorize, compare, type XiDachState } from "../src";

const R: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
/** "AS","10H","KD" -> cards */
const H = (...c: string[]): Card[] => c.map((x) => ({ rank: R[x.slice(0, -1)] ?? Number(x.slice(0, -1)), suit: x.slice(-1) as Suit }));
const F = e.meta.rulesFlags as any;
const seatsInfo = (n: number, chips = 10_000) => Array.from({ length: n }, (_, i) => ({ seat: i, id: "u" + i, name: "P" + i, isBot: false, chips }));

/** state with fixed hands; seat 0 dealer; deck = 2,3,4... safe fillers */
function st(hands: Record<number, Card[]>, extra: Partial<XiDachState> = {}): XiDachState {
  const dealer = 0;
  const seats = Object.keys(hands).map(Number).filter((x) => x !== dealer);
  const chips: Record<number, number> = {};
  for (const k of Object.keys(hands)) chips[Number(k)] = 10_000;
  return { seats, dealer, chips, baseBet: 100, flags: { ...F }, deck: H("2C", "3C", "4C", "2D", "3D", "4D", "5C").reverse(), hands, done: [], phase: "players", ...extra };
}

describe("hand maths", () => {
  it("ace flexible 1/10/11", () => {
    expect(points(H("AS", "KH"))).toBe(21);
    expect(points(H("AS", "9H"))).toBe(20);
    expect(points(H("AS", "AH", "9D"))).toBe(21);
    expect(points(H("AS", "AH", "AD"))).toBe(21); // 10+10+1
    expect(points(H("10S", "KH", "5D"))).toBe(25);
  });
  it("categories", () => {
    expect(categorize(H("AS", "AH")).kind).toBe("bang");
    expect(categorize(H("AS", "QH")).kind).toBe("dach");
    expect(categorize(H("AS", "9H")).kind).toBe("normal");
    expect(categorize(H("2S", "3H", "4D", "5C", "6S")).kind).toBe("linh");
    expect(categorize(H("9S", "9H", "9D", "2C", "2S")).kind).toBe("bust");
    expect(categorize(H("10S", "KH", "5D")).kind).toBe("bust");
  });
  it("comparison + multipliers", () => {
    const n = (p: number) => ({ kind: "normal" as const, points: p });
    expect(compare(n(20), n(18), F)).toBe(1);
    expect(compare(n(18), n(20), F)).toBe(-1);
    expect(compare(n(18), n(18), F)).toBe(0);
    expect(compare({ kind: "dach", points: 21 }, n(21), F)).toBe(2);
    expect(compare(n(20), { kind: "bang", points: 21 }, F)).toBe(-3);
    expect(compare({ kind: "bust", points: 25 }, { kind: "bust", points: 23 }, F)).toBe(-1); // player quắc always loses
    expect(compare(n(12), { kind: "bust", points: 23 }, F)).toBe(1);
    expect(compare({ kind: "linh", points: 20 }, { kind: "dach", points: 21 }, F)).toBe(3); // default: ngũ linh > xì dách
    expect(compare({ kind: "linh", points: 20 }, { kind: "dach", points: 21 }, { ...F, nguLinhBeatsXiDach: false })).toBe(-2);
  });
});

describe("rules flow", () => {
  it("dealer xì dách/xì bàng at deal ends the hand immediately", () => {
    expect(normalize(st({ 0: H("AS", "KH"), 1: H("9S", "8H") })).phase).toBe("over");
    expect(normalize(st({ 0: H("AS", "AH"), 1: H("9S", "8H") })).phase).toBe("over");
    expect(normalize(st({ 0: H("9S", "8H"), 1: H("9S", "8H") })).phase).toBe("players");
  });
  it("players with xì dách at deal are auto-finished", () => {
    const s = normalize(st({ 0: H("9S", "8H"), 1: H("AS", "KH"), 2: H("5S", "6H") }));
    expect(s.done).toEqual([1]);
    expect(e.toAct(s)).toEqual([2]);
  });
  it("player cannot stand under 16, must hit", () => {
    const s = st({ 0: H("9S", "8H"), 1: H("5S", "6H"), 2: H("10S", "7H") });
    expect(e.legalActions(s, 1).map((a) => a.type)).toEqual(["hit"]);
    expect("error" in e.apply(s, 1, { type: "stand" })).toBe(true);
    const r = e.apply(s, 1, { type: "hit" }) as { state: XiDachState };
    expect(r.state.hands[1]!.length).toBe(3);
  });
  it("turn order: players ascending then dealer; out-of-turn rejected", () => {
    let s = st({ 0: H("9S", "8H"), 1: H("10S", "7H"), 2: H("10S", "7H") });
    expect(e.toAct(s)).toEqual([1]);
    expect("error" in e.apply(s, 2, { type: "stand" })).toBe(true);
    s = (e.apply(s, 1, { type: "stand" }) as any).state;
    expect(e.toAct(s)).toEqual([2]);
    s = (e.apply(s, 2, { type: "stand" }) as any).state;
    expect(e.toAct(s)).toEqual([0]);
    expect(s.phase).toBe("dealer");
  });
  it("bust auto-finishes the player and passes the turn", () => {
    const bust = st({ 0: H("9S", "8H"), 1: H("10S", "5H", "4D"), 2: H("10S", "7H") }, { deck: H("KC") });
    const r = (e.apply(bust, 1, { type: "hit" }) as any).state as XiDachState;
    expect(r.done).toContain(1);
    expect(e.toAct(r)).toEqual([2]);
  });
  it("5 cards ends the turn (ngũ linh)", () => {
    const s = st({ 0: H("9S", "8H"), 1: H("2S", "3H", "4D", "2C"), 2: H("10S", "7H") }, { deck: H("3C") });
    const r = (e.apply(s, 1, { type: "hit" }) as any).state as XiDachState;
    expect(r.done).toContain(1);
    expect(categorize(r.hands[1]!).kind).toBe("linh");
  });
  it("views hide others' cards until over", () => {
    const s = st({ 0: H("9S", "8H"), 1: H("10S", "7H"), 2: H("2S", "7H") });
    const v = e.view(s, 1);
    expect(v.hands[1]).not.toBeNull();
    expect(v.hands[2]).toBeNull();
    expect(v.hands[0]).toBeNull();
    expect(v.counts[2]).toBe(2);
    expect(v.cats).toBeNull();
    const vo = e.view({ ...s, phase: "over" }, 1);
    expect(vo.hands[2]).not.toBeNull();
    expect(vo.cats).not.toBeNull();
  });
  it("settle: dealer pays only what it has, zero-sum", () => {
    const s = st({ 0: H("9S", "8H"), 1: H("AS", "KH"), 2: H("AS", "AH") }, { phase: "over", chips: { 0: 150, 1: 10_000, 2: 10_000 } });
    const p = e.settle(s);
    expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
    expect(p.find((x) => x.seat === 0)!.delta).toBe(-150);
  });
  it("settle: dealer quắc pays non-quắc players, quắc players lose", () => {
    const s = st({ 0: H("10S", "KH", "5D"), 1: H("9S", "8H"), 2: H("10S", "KH", "5C") }, { phase: "over" });
    const p = e.settle(s);
    expect(p.find((x) => x.seat === 1)!.delta).toBe(100);
    expect(p.find((x) => x.seat === 2)!.delta).toBe(-100);
  });
});

describe("full games with bots", () => {
  it("always legal, terminates, zero-sum (many seeds, 2-8 seats)", () => {
    for (let seed = 0; seed < 300; seed++) {
      const n = 2 + (seed % 7);
      const rng = seededRng(seed);
      let s = e.init({ seats: seatsInfo(n, seed % 5 === 0 ? 120 : 10_000), dealerSeat: seed % n, baseBet: 100, rng, flags: {} });
      let guard = 0;
      while (!e.isOver(s)) {
        if (++guard > 500) throw new Error("no termination");
        const [seat] = e.toAct(s);
        expect(seat).toBeDefined();
        const a = e.bot(s, seat!, rng);
        expect(e.legalActions(s, seat!).some((x) => x.type === a.type)).toBe(true);
        const r = e.apply(s, seat!, a);
        if ("error" in r) throw new Error(r.error);
        s = r.state;
      }
      const p = e.settle(s);
      expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
      expect(p.find((x) => x.seat === s.dealer)!.delta).toBeGreaterThanOrEqual(-s.chips[s.dealer]!);
      expect(new Set(Object.values(s.hands).flat().map((c) => `${c.rank}${c.suit}`)).size).toBe(Object.values(s.hands).flat().length); // no duplicate cards
    }
  });
  it("timeoutAction is always legal", () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = e.init({ seats: seatsInfo(4), dealerSeat: 0, baseBet: 100, rng: seededRng(seed), flags: {} });
      while (!e.isOver(s)) {
        const seat = e.toAct(s)[0]!;
        const a = e.timeoutAction!(s, seat);
        expect("error" in e.apply(s, seat, a)).toBe(false);
        s = (e.apply(s, seat, a) as any).state;
      }
    }
  });
});
