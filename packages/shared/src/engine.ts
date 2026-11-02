import type { RNG } from "./rng";
import type { SeatInfo } from "./types";

export interface Payout {
  seat: number;
  /** chip change for this seat; sum over all payouts MUST be 0 */
  delta: number;
}

export interface EngineMeta {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  hasDealer: boolean;
  /** default rule flags (variants). Shown to owner in RULES_DECISIONS.md */
  rulesFlags: Record<string, boolean | number>;
}

export interface InitConfig {
  seats: SeatInfo[]; // only occupied seats, includes chips (engine caps dealer payouts by chips)
  dealerSeat?: number;
  baseBet: number;
  rng: RNG;
  flags: Record<string, boolean | number>;
}

export type ApplyResult<S> = { state: S } | { error: string };

/**
 * Pure game engine. No I/O, no Date.now, no Math.random: use cfg.rng / rng args.
 * State S is server-private and may be mutated-copy or immutable (apply must return the new state).
 * View V is what one seat is allowed to see (hide others' hidden info).
 */
export interface GameEngine<S = any, A = any, V = any> {
  meta: EngineMeta;
  init(cfg: InitConfig): S;
  /** seats that must act right now (empty when hand is over). Room auto-plays bots/timeouts for these. */
  toAct(s: S): number[];
  legalActions(s: S, seat: number): A[];
  apply(s: S, seat: number, a: A): ApplyResult<S>;
  view(s: S, seat: number): V;
  isOver(s: S): boolean;
  /** only valid when isOver. Sum of deltas = 0; dealer pays at most the chips it has. */
  settle(s: S): Payout[];
  /** MUST return a legal action for a seat in toAct(s). */
  bot(s: S, seat: number, rng: RNG): A;
  /** Vietnamese rules text for the "Hướng dẫn" button. */
  rulesText: string;
}
