import type { RNG } from "./rng";

export type Suit = "S" | "C" | "D" | "H"; // spades, clubs, diamonds, hearts (Tiến lên order: S<C<D<H)
export interface Card {
  /** 1=A, 2..10, 11=J, 12=Q, 13=K */
  rank: number;
  suit: Suit;
}
export const SUITS: Suit[] = ["S", "C", "D", "H"];

export function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) d.push({ rank, suit });
  return d;
}

/** Fisher-Yates, returns new array. */
export function shuffle<T>(rng: RNG, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const cardKey = (c: Card) => `${c.rank}${c.suit}`;
