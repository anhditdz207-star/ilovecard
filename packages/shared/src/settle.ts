import type { Payout } from "./engine";

export interface VsDealerResult {
  seat: number;
  /** >0: dealer owes this player; <0: player owes dealer (give as negative number) */
  amount: number;
}

/**
 * Settle players vs a dealer. Dealer pays only what it has ("có bao nhiêu đền bấy nhiêu"):
 * pool = dealerChips + all player losses; winners are paid in seat order until pool is empty.
 * Losers pay at most their chips. Result sums to 0.
 */
export function settleVsDealer(
  dealerSeat: number,
  dealerChips: number,
  chipsBySeat: Record<number, number>,
  results: VsDealerResult[],
): Payout[] {
  const out: Payout[] = [];
  let pool = dealerChips;
  let dealerDelta = 0;
  for (const r of results) {
    if (r.amount < 0) {
      const pay = Math.min(-r.amount, chipsBySeat[r.seat] ?? 0);
      out.push({ seat: r.seat, delta: -pay });
      pool += pay;
      dealerDelta += pay;
    }
  }
  const winners = results.filter((r) => r.amount > 0).sort((a, b) => a.seat - b.seat);
  for (const r of winners) {
    const pay = Math.min(r.amount, pool);
    out.push({ seat: r.seat, delta: pay });
    pool -= pay;
    dealerDelta -= pay;
  }
  out.push({ seat: dealerSeat, delta: dealerDelta });
  return out;
}
