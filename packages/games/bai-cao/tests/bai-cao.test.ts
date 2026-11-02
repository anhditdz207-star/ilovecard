import { describe, expect, it } from "vitest";
import { seededRng, type Card } from "@cg/shared";
import { baiCaoEngine as e, baiCaoPoints, isBaTay, type BaiCaoState } from "../src";

const seats = [0, 1, 2].map((seat) => ({ seat, id: `p${seat}`, name: `P${seat}`, isBot: seat === 2, chips: seat === 0 ? 100 : 1000 }));
function play(seed: number, dealerChips = 100) {
  let s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(seed), flags: {} });
  while (!e.isOver(s)) {
    const [seat] = e.toAct(s), r = e.apply(s, seat!, e.bot(s, seat!, seededRng(seed)));
    if ("error" in r) throw new Error(r.error);
    s = r.state;
  }
  s = { ...s, chips: { ...s.chips, 0: dealerChips } };
  return { s, payouts: e.settle(s) };
}

describe("Bài Cào engine", () => {
  it("deals three unique cards per seat and hides unrevealed hands", () => {
    let s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(7), flags: {} });
    expect(Object.values(s.hands).flat()).toHaveLength(9);
    expect(new Set(Object.values(s.hands).flat().map((c) => `${c.rank}${c.suit}`)).size).toBe(9);
    expect(e.view(s, 1).hands[2]).toBeNull();
    s = (e.apply(s, 1, { type: "reveal" }) as { state: BaiCaoState }).state;
    expect(e.view(s, 1).hands[1]).toHaveLength(3);
    expect(e.view(s, 1).hands[2]).toBeNull();
  });
  it("settles zero-sum and caps dealer losses over many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const { s, payouts } = play(seed, seed % 3 ? 100 : 40);
      expect(payouts.reduce((sum, p) => sum + p.delta, 0)).toBe(0);
      expect(payouts.find((p) => p.seat === s.dealer)!.delta).toBeGreaterThanOrEqual(-s.chips[s.dealer]!);
    }
  });
  it("ranks Ba Tây above points and calculates points modulo ten", () => {
    const baTay: Card[] = [{ rank: 11, suit: "S" }, { rank: 12, suit: "D" }, { rank: 13, suit: "C" }];
    expect(isBaTay(baTay)).toBe(true);
    expect(baiCaoPoints([{ rank: 9, suit: "S" }, { rank: 8, suit: "D" }, { rank: 3, suit: "C" }])).toBe(0);
    const s = e.init({ seats: seats.slice(0, 2), dealerSeat: 0, baseBet: 10, rng: seededRng(9), flags: {} });
    expect(e.settle({ ...s, hands: { 0: [{ rank: 9, suit: "S" }, { rank: 8, suit: "D" }, { rank: 2, suit: "C" }], 1: baTay }, revealed: [1, 0] }).find((p) => p.seat === 1)!.delta).toBe(10);
  });
  it("pushes equal points", () => {
    const s = e.init({ seats: seats.slice(0, 2), dealerSeat: 0, baseBet: 10, rng: seededRng(10), flags: {} });
    const hand: Card[] = [{ rank: 4, suit: "S" }, { rank: 3, suit: "D" }, { rank: 2, suit: "C" }];
    const payouts = e.settle({ ...s, hands: { 0: hand, 1: hand }, revealed: [1, 0] });
    expect(payouts).toEqual([{ seat: 0, delta: 0 }]);
  });
  it("rejects out-of-turn reveals and bots choose legal actions", () => {
    const s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(8), flags: {} });
    expect("error" in e.apply(s, 0, { type: "reveal" })).toBe(true);
    expect(e.legalActions(s, 1)).toContainEqual(e.bot(s, 1, seededRng(1)));
  });
});
