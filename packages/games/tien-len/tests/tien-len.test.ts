import { describe, expect, it } from "vitest";
import { seededRng, type Card, type Suit } from "@cg/shared";
import { analyze, beats, chopLevel, generateMoves, whiteKind, tienLenNamEngine as nam, tienLenBacEngine as bac, type TLState, type TLAction } from "../src";

const R: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
const C = (...x: string[]): Card[] => x.map((t) => ({ rank: R[t.slice(0, -1)] ?? Number(t.slice(0, -1)), suit: t.slice(-1) as Suit }));
const info = (n: number, chips = 100_000) => Array.from({ length: n }, (_, i) => ({ seat: i, id: "u" + i, name: "P" + i, isBot: false, chips }));
const ctx = { lastIsChop: false, chatChong: true };
const A = (x: string[]) => analyze(C(...x))!;

/** state with fixed hands for seats; seat 0 to act, no white check */
function st(e: typeof nam, hands: Record<number, Card[]>, over: Partial<TLState> = {}): TLState {
  const base = e.init({ seats: info(Object.keys(hands).length), baseBet: 100, rng: seededRng(1), flags: { toiTrang: false } });
  const seats = Object.keys(hands).map(Number);
  const played: Record<number, number> = {};
  for (const x of seats) played[x] = 1;
  return { ...base, seats, hands, played, current: 0, lead: null, passed: [], finished: [], firstDone: true, lastIsChop: false, lastChop: null, chops: [], white: null, over: false, ...over };
}
const play = (e: typeof nam, s: TLState, seat: number, ...c: string[]) => e.apply(s, seat, { type: "play", cards: C(...c) });
const ok = (r: any): TLState => { if ("error" in r) throw new Error(r.error); return r.state; };

describe("combos", () => {
  it("recognises types", () => {
    expect(A(["3S"]).type).toBe("single");
    expect(A(["3S", "3H"]).type).toBe("pair");
    expect(A(["3S", "3C", "3D"]).type).toBe("triple");
    expect(A(["3S", "3C", "3D", "3H"]).type).toBe("quad");
    expect(A(["3S", "4C", "5D"]).type).toBe("straight");
    expect(A(["QS", "KC", "AD"]).type).toBe("straight");
    expect(A(["3S", "3C", "4D", "4H", "5S", "5C"]).type).toBe("pairs");
    expect(analyze(C("QS", "KC", "AD", "2H"))).toBeNull(); // 2 not in straight
    expect(analyze(C("3S", "4C", "6D"))).toBeNull();
    expect(analyze(C("3S", "3C", "4D", "4H", "6S", "6C"))).toBeNull();
    expect(analyze(C("3S", "3C", "3D", "3H", "3S"))).toBeNull();
  });
  it("ordering: 2 highest, suit decides ties", () => {
    const b = (p: string[], c: string[]) => beats(A(p), A(c), ctx);
    expect(b(["AS"], ["2S"])).toBe(true);
    expect(b(["KH"], ["AS"])).toBe(true);
    expect(b(["5S"], ["5H"])).toBe(true);
    expect(b(["5H"], ["5S"])).toBe(false);
    expect(b(["3S", "4S", "5S"], ["4S", "5S", "6S"])).toBe(true);
    expect(b(["3S", "4S", "5S"], ["4S", "5S", "6S", "7S"])).toBe(false); // different length
    expect(b(["3S", "3C"], ["4S"])).toBe(false);
  });
  it("chặt heo", () => {
    const b = (p: string[], c: string[], x = ctx) => beats(A(p), A(c), x);
    const dt3 = ["3S", "3C", "4S", "4C", "5S", "5C"];
    const quad = ["9S", "9C", "9D", "9H"];
    const dt4 = ["3S", "3C", "4S", "4C", "5S", "5C", "6S", "6C"];
    expect(b(["2S"], dt3)).toBe(true);
    expect(b(["2H"], quad)).toBe(true);
    expect(b(["2S", "2C"], dt3)).toBe(false);
    expect(b(["2S", "2C"], quad)).toBe(true);
    expect(b(["2S", "2C"], dt4)).toBe(true);
    expect(b(["5S"], dt3)).toBe(false); // chặt only works on 2s
    expect(chopLevel(A(dt3))).toBeLessThan(chopLevel(A(quad)));
    expect(chopLevel(A(quad))).toBeLessThan(chopLevel(A(dt4)));
  });
  it("chặt chồng only with flag and only on a chặt", () => {
    const dt3 = A(["3S", "3C", "4S", "4C", "5S", "5C"]);
    const quad = A(["9S", "9C", "9D", "9H"]);
    expect(beats(dt3, quad, { lastIsChop: true, chatChong: true })).toBe(true);
    expect(beats(dt3, quad, { lastIsChop: true, chatChong: false })).toBe(false);
    expect(beats(dt3, quad, { lastIsChop: false, chatChong: true })).toBe(false);
  });
  it("tới trắng detection", () => {
    expect(whiteKind(C("3S", "4S", "5S", "6S", "7S", "8S", "9S", "10S", "JS", "QS", "KS", "AS", "2S"))).toBe("rong");
    expect(whiteKind(C("2S", "2C", "2D", "2H", "3S", "5S", "7S", "9S", "JS", "KS", "4D", "6D", "8D"))).toBe("tuQuyHeo");
    expect(whiteKind(C("3S", "3C", "5S", "5C", "7S", "7C", "9S", "9C", "JS", "JC", "KS", "KC", "4D"))).toBe("sauDoi");
    expect(whiteKind(C("3S", "3C", "5S", "5C", "7S", "7C", "9S", "9C", "JS", "JC", "KS", "4H", "6D"))).toBeNull();
  });
  it("generateMoves only produces valid combos", () => {
    const hand = C("3S", "3C", "4S", "4D", "5S", "5H", "6C", "7D", "7H", "9S", "9C", "9D", "2H");
    const moves = generateMoves(hand);
    expect(moves.length).toBeGreaterThan(20);
    for (const m of moves) expect(analyze(m)).not.toBeNull();
  });
});

describe("turn flow", () => {
  it("first move must contain 3♠; lowest holder starts", () => {
    const s = nam.init({ seats: info(4), baseBet: 100, rng: seededRng(3), flags: { toiTrang: false } });
    const cur = s.current;
    expect(s.hands[cur]!.some((c) => c.rank === 3 && c.suit === "S")).toBe(true);
    const other = s.hands[cur]!.find((c) => !(c.rank === 3 && c.suit === "S"))!;
    expect("error" in nam.apply(s, cur, { type: "play", cards: [other] })).toBe(true);
    expect("error" in nam.apply(s, (cur + 1) % 4, { type: "pass" })).toBe(true);
    expect("error" in nam.apply(s, cur, { type: "pass" })).toBe(true); // leading cannot pass
  });
  it("pass removes you from the round; round winner leads again", () => {
    let s = st(nam, { 0: C("4S", "9H", "KC"), 1: C("5S", "QH", "AC"), 2: C("6S", "JH", "2C") });
    s = ok(play(nam, s, 0, "4S"));
    expect(s.current).toBe(1);
    s = ok(nam.apply(s, 1, { type: "pass" }));
    expect(s.current).toBe(2);
    s = ok(play(nam, s, 2, "6S"));
    expect(s.current).toBe(0); // 1 passed, skipped; back to 0
    s = ok(nam.apply(s, 0, { type: "pass" }));
    expect(s.lead).toBeNull(); // everyone else passed -> seat 2 leads again
    expect(s.current).toBe(2);
  });
  it("rejects weaker/other-type plays and cards not in hand", () => {
    let s = st(nam, { 0: C("9S", "9C", "KH"), 1: C("5S", "QH", "AC") });
    s = ok(play(nam, s, 0, "9S", "9C"));
    expect("error" in play(nam, s, 1, "QH")).toBe(true);
    expect("error" in play(nam, s, 1, "5H")).toBe(true);
  });
  it("leader finishing: next player leads after the others pass", () => {
    let s = st(nam, { 0: C("4S"), 1: C("5S", "QH"), 2: C("6S", "JH") });
    s = ok(play(nam, s, 0, "4S"));
    expect(s.finished).toEqual([0]);
    s = ok(nam.apply(s, 1, { type: "pass" }));
    s = ok(nam.apply(s, 2, { type: "pass" }));
    expect(s.lead).toBeNull();
    expect(s.current).toBe(1); // next active after finished leader
  });
  it("game ends when one player is left; ranks recorded", () => {
    let s = st(nam, { 0: C("4S"), 1: C("5S"), 2: C("6S", "JH") });
    s = ok(play(nam, s, 0, "4S"));
    s = ok(play(nam, s, 1, "5S"));
    expect(s.over).toBe(true);
    expect(s.finished).toEqual([0, 1, 2]);
  });
});

describe("settlement", () => {
  const over = (e: typeof nam, hands: Record<number, Card[]>, finished: number[], extra: Partial<TLState> = {}) => st(e, hands, { over: true, finished, ...extra });
  it("rank payouts (4p: +3/+1/-1/-3) and zero-sum", () => {
    const s = over(bac, { 0: [], 1: [], 2: [], 3: C("3S") }, [2, 0, 1, 3]);
    const p = bac.settle(s);
    const d = (seat: number) => p.find((x) => x.seat === seat)!.delta;
    expect([d(2), d(0), d(1), d(3)]).toEqual([300, 100, -100, -300]);
    expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
  });
  it("Nam: chặt heo money, cóng, thối heo", () => {
    const s = over(nam, { 0: [], 1: C("2H"), 2: [] }, [0, 2, 1], {
      chops: [{ from: 1, to: 2, units: 2 }], played: { 0: 3, 1: 0, 2: 2 },
    });
    const p = nam.settle(s);
    const d = (seat: number) => p.find((x) => x.seat === seat)!.delta;
    // ranks 3p: +2/0/-2 ; chop: seat1 -> seat2 2 ; cóng seat1 -> winner 2 ; thối heo đỏ seat1 -> winner 2
    expect(d(0)).toBe((2 + 2 + 2) * 100);
    expect(d(2)).toBe(2 * 100);
    expect(d(1)).toBe(-(2 + 2 + 2 + 2) * 100);
    expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
  });
  it("Bắc ignores chặt money / cóng / thối", () => {
    const s = over(bac, { 0: [], 1: C("2H"), 2: [] }, [0, 2, 1], { chops: [{ from: 1, to: 2, units: 2 }], played: { 0: 3, 1: 0, 2: 2 } });
    const p = bac.settle(s);
    expect(p.find((x) => x.seat === 0)!.delta).toBe(200);
  });
  it("chặt heo through apply records money; chặt chồng moves it", () => {
    let s = st(nam, {
      0: C("2H", "4S"), 1: C("3S", "3C", "4C", "4D", "5S", "5D", "8H"), 2: C("9S", "9C", "9D", "9H", "KC"),
    });
    s = ok(play(nam, s, 0, "2H"));
    s = ok(play(nam, s, 1, "3S", "3C", "4C", "4D", "5S", "5D"));
    expect(s.chops).toEqual([{ from: 0, to: 1, units: 2 }]);
    s = ok(play(nam, s, 2, "9S", "9C", "9D", "9H")); // chặt chồng
    expect(s.chops).toEqual([{ from: 0, to: 2, units: 2 }, { from: 1, to: 2, units: 2 }]);
    const b = st(bac, { 0: C("2H", "4S"), 1: C("3S", "3C", "4C", "4D", "5S", "5D", "8H"), 2: C("9S", "9C", "9D", "9H", "KC") });
    let t = ok(play(bac, b, 0, "2H"));
    t = ok(play(bac, t, 1, "3S", "3C", "4C", "4D", "5S", "5D"));
    expect("error" in play(bac, t, 2, "9S", "9C", "9D", "9H")).toBe(true);
  });
  it("tới trắng ends the hand at once", () => {
    for (let seed = 0; seed < 4000; seed++) {
      const s = nam.init({ seats: info(4), baseBet: 100, rng: seededRng(seed), flags: {} });
      if (s.white) {
        expect(s.over).toBe(true);
        const p = nam.settle(s);
        expect(p.find((x) => x.seat === s.white!.seat)!.delta).toBe(900);
        expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
        return;
      }
    }
    throw new Error("no white win found in 4000 seeds");
  });
});

describe("full games with bots", () => {
  for (const [name, e] of [["nam", nam], ["bac", bac]] as const) {
    it(`${name}: always legal, terminates, conserves cards, zero-sum`, () => {
      for (let seed = 0; seed < 150; seed++) {
        const n = 2 + (seed % 3);
        const rng = seededRng(seed + 1000);
        let s = e.init({ seats: info(n, seed % 4 === 0 ? 150 : 100_000), baseBet: 100, rng, flags: {} });
        let guard = 0;
        while (!e.isOver(s)) {
          if (++guard > 1500) throw new Error("no termination seed " + seed);
          const seat = e.toAct(s)[0]!;
          const a: TLAction = e.bot(s, seat, rng);
          const r = e.apply(s, seat, a);
          if ("error" in r) throw new Error(`seed ${seed}: ${r.error} ${JSON.stringify(a)}`);
          s = r.state;
          const all = Object.values(s.hands).flat().length + 0;
          expect(all).toBeLessThanOrEqual(13 * n);
        }
        const p = e.settle(s);
        expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
        for (const x of p) expect(x.delta).toBeGreaterThanOrEqual(-s.chips[x.seat]!);
        expect(new Set(s.finished).size).toBe(n);
      }
    });
  }
  it("timeoutAction is always legal; views hide hands until over", () => {
    for (let seed = 0; seed < 60; seed++) {
      let s = nam.init({ seats: info(4), baseBet: 100, rng: seededRng(seed), flags: { toiTrang: false } });
      let guard = 0;
      while (!nam.isOver(s) && guard++ < 1500) {
        const seat = nam.toAct(s)[0]!;
        const v = nam.view(s, (seat + 1) % 4);
        expect(v.hands).toBeNull();
        expect(v.hand).toEqual(s.hands[(seat + 1) % 4]);
        const r = nam.apply(s, seat, nam.timeoutAction!(s, seat));
        if ("error" in r) throw new Error(r.error);
        s = r.state;
      }
      expect(nam.isOver(s)).toBe(true);
      expect(nam.view(s, 0).hands).not.toBeNull();
    }
  });
});
