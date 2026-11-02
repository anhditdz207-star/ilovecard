import { describe, expect, it } from "vitest";
import { seededRng } from "@cg/shared";
import { baccaratEngine as e, type BaccaratState } from "../src";

const seats = [0, 1, 2].map((seat) => ({ seat, id: `p${seat}`, name: `P${seat}`, isBot: seat === 2, chips: 1000 }));
function play(seed: number) {
  let s = e.init({ seats, baseBet: 100, rng: seededRng(seed), flags: {} });
  while (!e.isOver(s)) for (const seat of [...e.toAct(s)]) {
    const action = e.bot(s, seat, seededRng(seed + seat));
    expect(e.legalActions(s, seat)).toContainEqual(action);
    const r = e.apply(s, seat, action);
    if ("error" in r) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe("Baccarat engine", () => {
  it("deals only after all seats bet and hides cards before then", () => {
    let s = e.init({ seats, baseBet: 100, rng: seededRng(2), flags: {} });
    expect(e.view(s, 0).hand).toBeNull();
    s = (e.apply(s, 0, { type: "bet", side: "player", amount: 100 }) as { state: BaccaratState }).state;
    expect(e.view(s, 1).hand).toBeNull();
    expect(e.toAct(s)).toEqual([1, 2]);
    s = (e.apply(s, 1, { type: "bet", side: "banker", amount: 100 }) as { state: BaccaratState }).state;
    s = (e.apply(s, 2, { type: "bet", side: "tie", amount: 100 }) as { state: BaccaratState }).state;
    expect(e.isOver(s)).toBe(true);
    expect(e.view(s, 0).hand).not.toBeNull();
  });
  it("balances outcomes and caps every seat's loss at its chips", () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = play(seed), payout = e.settle(s);
      expect(payout.reduce((sum, p) => sum + p.delta, 0)).toBe(0);
      for (const p of payout) expect(p.delta).toBeGreaterThanOrEqual(-s.chips[p.seat]!);
    }
  });
  it("rejects invalid or unaffordable bets", () => {
    const s = e.init({ seats, baseBet: 100, rng: seededRng(4), flags: {} });
    expect("error" in e.apply(s, 0, { type: "bet", side: "player", amount: 1001 })).toBe(true);
    expect("error" in e.apply(s, 0, { type: "bet", side: "bad" as "player", amount: 1 })).toBe(true);
  });
  it("charges a tie bet when another side wins", () => {
    const s = e.init({ seats, baseBet: 100, rng: seededRng(6), flags: {} });
    const settled = { ...s, hand: { player: [], banker: [], winner: "banker" as const }, bets: {
      0: { type: "bet" as const, side: "banker" as const, amount: 100 },
      1: { type: "bet" as const, side: "player" as const, amount: 100 },
      2: { type: "bet" as const, side: "tie" as const, amount: 100 },
    } };
    expect(e.settle(settled).reduce((sum, p) => sum + p.delta, 0)).toBe(0);
    expect(e.settle(settled).find((p) => p.seat === 2)!.delta).toBeLessThan(0);
  });
});
