import {
  makeDeck, shuffle, settleVsDealer,
  type Card, type GameEngine, type RNG, type Payout, type SeatInfo,
} from "@cg/shared";

/** DEMO engine used to test the room framework. Each player draws 1 card; higher than dealer wins baseBet. */
export interface DemoState {
  seats: number[]; // non-dealer seats, then dealer last
  dealer: number;
  baseBet: number;
  chips: Record<number, number>;
  deck: Card[];
  hands: Record<number, Card | null>;
}
export type DemoAction = { type: "draw" };
export interface DemoView {
  me: number;
  hands: Record<number, Card | null>; // others hidden (null) until over
  over: boolean;
}

const cmpRank = (a: Card, b: Card) => (a.rank === 1 ? 14 : a.rank) - (b.rank === 1 ? 14 : b.rank);

export const demoEngine: GameEngine<DemoState, DemoAction, DemoView> = {
  meta: {
    id: "demo", name: "Demo", minPlayers: 2, maxPlayers: 6, hasDealer: true,
    rulesFlags: {},
  },
  rulesText:
    "Demo: mỗi người rút 1 lá. Lá cao hơn nhà cái thắng mức cược, thấp hơn thì thua, bằng nhau thì hoà. Nhà cái rút cuối.",
  init(cfg) {
    const dealer = cfg.dealerSeat ?? cfg.seats[0]!.seat;
    const players = cfg.seats.map((s: SeatInfo) => s.seat).filter((x) => x !== dealer);
    const chips: Record<number, number> = {};
    for (const s of cfg.seats) chips[s.seat] = s.chips;
    const hands: Record<number, Card | null> = {};
    for (const s of cfg.seats) hands[s.seat] = null;
    return { seats: [...players, dealer], dealer, baseBet: cfg.baseBet, chips, deck: shuffle(cfg.rng, makeDeck()), hands };
  },
  toAct(s) {
    const next = s.seats.find((x) => s.hands[x] === null);
    return next === undefined ? [] : [next];
  },
  legalActions(s, seat) {
    return this.toAct(s).includes(seat) ? [{ type: "draw" }] : [];
  },
  apply(s, seat, a) {
    if (!this.toAct(s).includes(seat)) return { error: "not your turn" };
    if (a?.type !== "draw") return { error: "bad action" };
    const deck = s.deck.slice();
    const card = deck.pop()!;
    return { state: { ...s, deck, hands: { ...s.hands, [seat]: card } } };
  },
  view(s, seat) {
    const over = this.isOver(s);
    const hands: Record<number, Card | null> = {};
    for (const k of Object.keys(s.hands)) {
      const n = Number(k);
      hands[n] = over || n === seat ? s.hands[n]! : null;
    }
    return { me: seat, hands, over };
  },
  isOver: (s) => s.seats.every((x) => s.hands[x] !== null),
  settle(s): Payout[] {
    const d = s.hands[s.dealer]!;
    const results = s.seats
      .filter((x) => x !== s.dealer)
      .map((x) => {
        const c = s.hands[x]!;
        const diff = cmpRank(c, d);
        return { seat: x, amount: diff > 0 ? s.baseBet : diff < 0 ? -s.baseBet : 0 };
      });
    return settleVsDealer(s.dealer, s.chips[s.dealer]!, s.chips, results);
  },
  bot: () => ({ type: "draw" }),
};
