import { settleVsDealer, type GameEngine, type Payout, type RNG, type SeatInfo } from "@cg/shared";

export const TILES = ["bau", "cua", "tom", "ca", "ga", "nai"] as const;
export type Tile = (typeof TILES)[number];
export type Bets = Partial<Record<Tile, number>>;
export type BauCuaAction = { type: "bet"; bets: Bets } | { type: "roll" };

export interface BauCuaState {
  seats: number[];
  dealer: number;
  chips: Record<number, number>;
  baseBet: number;
  bets: Record<number, Bets>;
  submitted: number[];
  dice: Tile[];
  revealedDice: Tile[] | null;
}
export interface BauCuaView {
  me: number;
  dealer: number;
  phase: "betting" | "rolling" | "over";
  bets: Record<number, Bets>;
  submitted: number[];
  dice: Tile[] | null;
}

const RULES = "Mỗi người chơi chọn một hay nhiều linh vật và đặt chip. Có thể bỏ lượt. Nhà cái gieo 3 xúc xắc sau khi mọi người xác nhận. Mỗi mặt trùng với linh vật đã cược trả lại số chip bằng tiền cược; nếu trùng nhiều mặt, nhận bội số tương ứng. Cược không trúng mất số chip đã đặt. Nhà cái trả tối đa số chip mình có. Chỉ dùng chip ảo, chơi giải trí, không dùng tiền thật.";

export const bauCuaEngine: GameEngine<BauCuaState, BauCuaAction, BauCuaView> = {
  meta: { id: "bau-cua", name: "Bầu Cua", minPlayers: 2, maxPlayers: 12, hasDealer: true, rulesFlags: {} },
  rulesText: RULES,
  init({ seats, dealerSeat, baseBet, rng }: { seats: SeatInfo[]; dealerSeat?: number; baseBet: number; rng: RNG }) {
    const dealer = dealerSeat ?? seats[0]!.seat;
    const chips: Record<number, number> = {};
    const bets: Record<number, Bets> = {};
    for (const seat of seats) { chips[seat.seat] = seat.chips; bets[seat.seat] = {}; }
    return {
      seats: seats.map((s) => s.seat), dealer, chips, baseBet, bets, submitted: [],
      dice: [TILES[rng.int(TILES.length)]!, TILES[rng.int(TILES.length)]!, TILES[rng.int(TILES.length)]!],
      revealedDice: null,
    };
  },
  toAct(s) {
    if (s.revealedDice) return [];
    const players = s.seats.filter((seat) => seat !== s.dealer && !s.submitted.includes(seat));
    return players.length ? players : [s.dealer];
  },
  legalActions(s, seat) {
    if (!this.toAct(s).includes(seat)) return [];
    if (seat === s.dealer) return [{ type: "roll" }];
    const pass: BauCuaAction = { type: "bet", bets: {} };
    const unit = Math.min(s.baseBet, s.chips[seat] ?? 0);
    return unit > 0 ? [pass, ...TILES.map((tile) => ({ type: "bet" as const, bets: { [tile]: unit } }))] : [pass];
  },
  apply(s, seat, action) {
    if (!this.toAct(s).includes(seat)) return { error: "Chưa đến lượt" };
    if (seat === s.dealer) {
      if (action?.type !== "roll") return { error: "Nhà cái cần gieo xúc xắc" };
      return { state: { ...s, revealedDice: s.dice } };
    }
    if (action?.type !== "bet" || !action.bets || typeof action.bets !== "object") return { error: "Cược không hợp lệ" };
    let total = 0;
    for (const [tile, amount] of Object.entries(action.bets)) {
      if (!TILES.includes(tile as Tile) || !Number.isSafeInteger(amount) || amount! < 0) return { error: "Mức cược không hợp lệ" };
      total += amount!;
    }
    if (total > (s.chips[seat] ?? 0)) return { error: "Không đủ chip" };
    return { state: { ...s, bets: { ...s.bets, [seat]: { ...action.bets } }, submitted: [...s.submitted, seat] } };
  },
  view(s, seat) {
    return { me: seat, dealer: s.dealer, phase: s.revealedDice ? "over" : this.toAct(s).includes(s.dealer) ? "rolling" : "betting", bets: s.bets, submitted: s.submitted, dice: s.revealedDice };
  },
  isOver: (s) => s.revealedDice !== null,
  settle(s): Payout[] {
    if (!s.revealedDice) return [];
    const counts = Object.fromEntries(TILES.map((tile) => [tile, s.revealedDice!.filter((die) => die === tile).length])) as Record<Tile, number>;
    const results = s.seats.filter((seat) => seat !== s.dealer).map((seat) => {
      let net = 0;
      for (const tile of TILES) {
        const wager = s.bets[seat]?.[tile] ?? 0;
        net += wager ? (counts[tile] ? wager * counts[tile] : -wager) : 0;
      }
      return { seat, amount: net };
    });
    return settleVsDealer(s.dealer, s.chips[s.dealer] ?? 0, s.chips, results);
  },
  /** human timeout = pass (no bet), never a random bet */
  timeoutAction: (s, seat) => (seat === s.dealer ? { type: "roll" } : { type: "bet", bets: {} }),
  bot(s, seat, rng) {
    const legal = this.legalActions(s, seat);
    if (seat === s.dealer) return { type: "roll" };
    return legal[rng.int(legal.length)]!;
  },
};

export { RULES as bauCuaRulesText };
