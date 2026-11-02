import { describe, it, expect } from "vitest";
import { seededRng } from "@cg/shared";
import { demoEngine as e } from "../src";

function play(seed: number, dealerChips = 1000) {
  const seats = [0, 1, 2].map((i) => ({ seat: i, id: "x" + i, name: "p" + i, isBot: false, chips: i === 0 ? dealerChips : 1000 }));
  let s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(seed), flags: {} });
  while (!e.isOver(s)) {
    const [seat] = e.toAct(s);
    const r = e.apply(s, seat!, e.bot(s, seat!, seededRng(1)));
    if ("error" in r) throw new Error(r.error);
    s = r.state;
  }
  return { s, payouts: e.settle(s) };
}

describe("demo engine", () => {
  it("always settles to zero, many seeds", () => {
    for (let i = 0; i < 200; i++) {
      const { payouts } = play(i, i % 3 === 0 ? 50 : 1000);
      expect(payouts.reduce((a, b) => a + b.delta, 0)).toBe(0);
    }
  });
  it("hides other hands until over", () => {
    const seats = [0, 1].map((i) => ({ seat: i, id: "x" + i, name: "p" + i, isBot: false, chips: 1000 }));
    let s = e.init({ seats, dealerSeat: 0, baseBet: 10, rng: seededRng(5), flags: {} });
    s = (e.apply(s, 1, { type: "draw" }) as any).state;
    expect(e.view(s, 0).hands[1]).toBeNull();
    expect(e.view(s, 1).hands[1]).not.toBeNull();
  });
  it("rejects out-of-turn", () => {
    const seats = [0, 1].map((i) => ({ seat: i, id: "x" + i, name: "p" + i, isBot: false, chips: 1000 }));
    const s = e.init({ seats, dealerSeat: 0, baseBet: 10, rng: seededRng(5), flags: {} });
    expect("error" in e.apply(s, 0, { type: "draw" })).toBe(true);
  });
});
