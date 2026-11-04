import { describe, expect, it } from "vitest";
import { seededRng, type Card, type Suit } from "@cg/shared";
import { baccaratEngine as e, deal, type BaccaratState } from "../src";

const seats = [0, 1, 2].map((seat) => ({ seat, id: `p${seat}`, name: `P${seat}`, isBot: seat === 2, chips: 1000 }));
const card = (rank: number): Card => ({ rank, suit: "S" as Suit });
/** shoe where draw() pops from the END: pass cards in draw order */
const shoe = (...ranks: number[]) => ranks.map(card).reverse();
const bet = (side: "player" | "banker" | "tie", amount = 100) => ({ type: "bet" as const, side, amount });
const settled = (winner: "player" | "banker" | "tie", bets: Record<number, any>): BaccaratState => {
  const s = e.init({ seats, baseBet: 100, rng: seededRng(6), flags: {} });
  return { ...s, hand: { player: [], banker: [], winner }, bets };
};

describe("Baccarat engine", () => {
  it("is house-banked and deals only after all seats act", () => {
    expect(e.meta.houseBanked).toBe(true);
    let s = e.init({ seats, baseBet: 100, rng: seededRng(2), flags: {} });
    expect(e.view(s, 0).hand).toBeNull();
    s = (e.apply(s, 0, bet("player")) as { state: BaccaratState }).state;
    expect(e.toAct(s)).toEqual([1, 2]);
    s = (e.apply(s, 1, bet("banker")) as { state: BaccaratState }).state;
    s = (e.apply(s, 2, { type: "pass" }) as { state: BaccaratState }).state;
    expect(e.isOver(s)).toBe(true);
    expect(e.settle(s).find((p) => p.seat === 2)).toBeUndefined();
  });
  it("pays 1:1 player, 0.95:1 banker, 8:1 tie; losers lose their bet; tie pushes others", () => {
    const b = { 0: bet("player"), 1: bet("banker"), 2: bet("tie") };
    expect(e.settle(settled("player", b))).toEqual([{ seat: 0, delta: 100 }, { seat: 1, delta: -100 }, { seat: 2, delta: -100 }]);
    expect(e.settle(settled("banker", b))).toEqual([{ seat: 0, delta: -100 }, { seat: 1, delta: 95 }, { seat: 2, delta: -100 }]);
    expect(e.settle(settled("tie", b))).toEqual([{ seat: 0, delta: 0 }, { seat: 1, delta: 0 }, { seat: 2, delta: 800 }]);
  });
  it("everyone can win together (no pooling of chips)", () => {
    const p = e.settle(settled("player", { 0: bet("player"), 1: bet("player"), 2: bet("player") }));
    expect(p.every((x) => x.delta === 100)).toBe(true);
  });
  it("third-card rules (draw order: player x2, banker x2, then thirds)", () => {
    let d = deal(shoe(2, 4, 3, 10, 9)); // player 6 stands -> banker 3 draws
    expect(d.hand.player).toHaveLength(2);
    expect(d.hand.banker).toHaveLength(3);
    d = deal(shoe(4, 4, 3, 5, 9, 9)); // player natural 8 -> nobody draws
    expect(d.hand.player).toHaveLength(2);
    expect(d.hand.banker).toHaveLength(2);
    d = deal(shoe(1, 1, 1, 2, 8)); // player 2 draws an 8; banker 3 stands vs third=8
    expect(d.hand.player).toHaveLength(3);
    expect(d.hand.banker).toHaveLength(2);
    d = deal(shoe(2, 3, 2, 4, 5)); // player draws 5; banker 6 stands (needs third 6/7)
    expect(d.hand.banker).toHaveLength(2);
    d = deal(shoe(2, 3, 2, 4, 6, 9)); // player draws 6; banker 6 draws
    expect(d.hand.banker).toHaveLength(3);
  });
  it("rejects invalid or unaffordable bets; timeout = pass; bots always legal", () => {
    const s = e.init({ seats, baseBet: 100, rng: seededRng(4), flags: {} });
    expect("error" in e.apply(s, 0, bet("player", 1001))).toBe(true);
    expect("error" in e.apply(s, 0, { type: "bet", side: "bad" as "player", amount: 1 })).toBe(true);
    expect(e.timeoutAction!(s, 0)).toEqual({ type: "pass" });
    for (let seed = 0; seed < 100; seed++) {
      let g = e.init({ seats, baseBet: 100, rng: seededRng(seed), flags: {} });
      while (!e.isOver(g)) for (const seat of [...e.toAct(g)]) {
        const r = e.apply(g, seat, e.bot(g, seat, seededRng(seed + seat)));
        if ("error" in r) throw new Error(r.error);
        g = r.state;
      }
      for (const p of e.settle(g)) expect(p.delta).toBeGreaterThanOrEqual(-g.chips[p.seat]!);
    }
  });
});
