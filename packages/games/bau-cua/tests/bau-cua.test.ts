import { describe, expect, it } from "vitest";
import { seededRng } from "@cg/shared";
import { bauCuaEngine as e, TILES, type BauCuaState, type Tile } from "../src";

const seats = [0, 1, 2].map((seat) => ({ seat, id: `p${seat}`, name: `P${seat}`, isBot: seat === 2, chips: seat === 0 ? 100 : 1000 }));
function play(seed: number) {
  let s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(seed), flags: {} });
  while (!e.isOver(s)) {
    for (const seat of e.toAct(s)) {
      const r = e.apply(s, seat, e.bot(s, seat, seededRng(seed + seat + 1)));
      if ("error" in r) throw new Error(r.error);
      s = r.state;
    }
  }
  return s;
}

describe("Bầu Cua engine", () => {
  it("settles to zero and caps dealer payouts over many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = play(seed);
      const payout = e.settle(s);
      expect(payout.reduce((sum, p) => sum + p.delta, 0)).toBe(0);
      expect(payout.find((p) => p.seat === s.dealer)!.delta).toBeGreaterThanOrEqual(-s.chips[s.dealer]!);
    }
  });

  it("keeps dice private until every bettor submits and dealer rolls", () => {
    let s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(12), flags: {} });
    expect(e.view(s, 1).dice).toBeNull();
    s = (e.apply(s, 1, { type: "bet", bets: { bau: 100 } }) as { state: BauCuaState }).state;
    expect(e.toAct(s)).toContain(2);
    expect(e.view(s, 1).dice).toBeNull();
    s = (e.apply(s, 2, { type: "bet", bets: {} }) as { state: BauCuaState }).state;
    expect(e.toAct(s)).toEqual([0]);
    s = (e.apply(s, 0, { type: "roll" }) as { state: BauCuaState }).state;
    expect(e.view(s, 1).dice).toEqual(s.dice);
  });

  it("rejects overspending and invalid tiles", () => {
    const s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(3), flags: {} });
    expect("error" in e.apply(s, 1, { type: "bet", bets: { bau: 1001 } })).toBe(true);
    expect("error" in e.apply(s, 1, { type: "bet", bets: { nope: 1 } as unknown as Record<Tile, number> })).toBe(true);
  });

  it("pays once per matching die, capped by dealer chips", () => {
    const s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(9), flags: {} });
    const over = { ...s, bets: { ...s.bets, 1: { bau: 50 } }, revealedDice: ["bau", "bau", "ca"] as Tile[] };
    expect(e.settle(over)).toEqual([{ seat: 1, delta: 100 }, { seat: 0, delta: -100 }]);
    const capped = { ...over, chips: { ...over.chips, 0: 40 } };
    expect(e.settle(capped)).toEqual([{ seat: 1, delta: 40 }, { seat: 0, delta: -40 }]);
  });

  it("bots always choose a legal action", () => {
    let s = e.init({ seats, dealerSeat: 0, baseBet: 100, rng: seededRng(4), flags: {} });
    while (!e.isOver(s)) {
      for (const seat of e.toAct(s)) {
        const action = e.bot(s, seat, seededRng(seat + s.submitted.length));
        expect(e.legalActions(s, seat)).toContainEqual(action);
        const r = e.apply(s, seat, action);
        expect("error" in r).toBe(false);
        if (!("error" in r)) s = r.state;
      }
    }
  });

  it("uses three dice from the six legal tiles", () => {
    const s = play(81);
    expect(s.dice).toHaveLength(3);
    expect(s.dice.every((tile) => (TILES as readonly string[]).includes(tile))).toBe(true);
  });
});
