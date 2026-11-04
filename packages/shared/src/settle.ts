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

/**
 * Settle a zero-sum "net" map (seat -> chips won(+)/lost(-), sums to 0) with chip caps:
 * a loser pays at most its chips; winners share what was actually collected, proportionally.
 * Result always sums to 0.
 */
export function settleNet(chips: Record<number, number>, net: Record<number, number>): Payout[] {
  const seats = Object.keys(net).map(Number).sort((a, b) => a - b);
  const out: Payout[] = [];
  let pool = 0;
  let gainTotal = 0;
  for (const seat of seats) {
    const n = net[seat]!;
    if (n < 0) {
      const pay = Math.min(-n, chips[seat] ?? 0);
      pool += pay;
      out.push({ seat, delta: -pay });
    } else if (n > 0) gainTotal += n;
  }
  const winners = seats.filter((x) => net[x]! > 0);
  let given = 0;
  const gains = new Map<number, number>();
  for (const seat of winners) {
    const g = gainTotal ? Math.floor((net[seat]! * pool) / gainTotal) : 0;
    gains.set(seat, g);
    given += g;
  }
  let rest = pool - given;
  for (const seat of winners) {
    if (rest <= 0) break;
    gains.set(seat, gains.get(seat)! + 1);
    rest--;
  }
  for (const seat of winners) out.push({ seat, delta: gains.get(seat)! });
  for (const seat of seats) if (net[seat] === 0) out.push({ seat, delta: 0 });
  return out.sort((a, b) => a.seat - b.seat);
}
