import { makeDeck, shuffle, type Card, type GameEngine, type Payout, type RNG, type SeatInfo } from "@cg/shared";

export type BaccaratSide = "player" | "banker" | "tie";
export type BaccaratAction = { type: "bet"; side: BaccaratSide; amount: number };
export interface BaccaratHand { player: Card[]; banker: Card[]; winner: BaccaratSide; }
export interface BaccaratState {
  seats: number[]; chips: Record<number, number>; baseBet: number;
  bets: Record<number, BaccaratAction | null>; shoe: Card[]; hand: BaccaratHand | null;
}
export interface BaccaratView {
  me: number; bets: Record<number, BaccaratAction | null>; submitted: number[];
  hand: BaccaratHand | null; outcome: BaccaratSide | null;
}
const SIDES: BaccaratSide[] = ["player", "banker", "tie"];
const RULES = "Mỗi người chọn Player, Banker hoặc Tie và đặt cược. Hai bên được chia hai lá, có thể rút lá thứ ba theo luật Baccarat chuẩn. Điểm tính theo hàng đơn vị (A=1, 2–9 theo số, 10/J/Q/K=0); 8 hoặc 9 tự nhiên thì dừng. Player thắng trả 1:1, Banker thắng trả 0,95:1 (đã trừ hoa hồng 5%), Tie trả 8:1; cược sai mất, hòa thì hoàn cược. Chip thắng được chia trong tổng tiền cược của bàn để ván chơi không tạo hoặc mất chip. Chỉ dùng chip ảo, chơi giải trí, không dùng tiền thật.";
const points = (card: Card) => card.rank >= 10 ? 0 : card.rank;
const total = (cards: Card[]) => cards.reduce((n, c) => n + points(c), 0) % 10;

function deal(shoe: Card[]): { hand: BaccaratHand; shoe: Card[] } {
  const cards = shoe.slice();
  const draw = () => cards.pop()!;
  const player = [draw(), draw()];
  const banker = [draw(), draw()];
  const playerTotal = total(player), bankerTotal = total(banker);
  if (playerTotal < 8 && bankerTotal < 8) {
    let playerThird: Card | undefined;
    if (playerTotal <= 5) { playerThird = draw(); player.push(playerThird); }
    const b = total(banker);
    const bankDraws = playerThird === undefined
      ? b <= 5
      : b <= 2 || (b === 3 && points(playerThird) !== 8) || (b === 4 && points(playerThird) >= 2 && points(playerThird) <= 7) || (b === 5 && points(playerThird) >= 4 && points(playerThird) <= 7) || (b === 6 && points(playerThird) >= 6 && points(playerThird) <= 7);
    if (bankDraws) banker.push(draw());
  }
  const p = total(player), b = total(banker);
  return { hand: { player, banker, winner: p === b ? "tie" : p > b ? "player" : "banker" }, shoe: cards };
}

/** Distribute gross outcomes proportionally across the losing side; integer chips always balance. */
function balance(raw: Record<number, number>, seats: number[]): Payout[] {
  const sum = seats.reduce((n, seat) => n + raw[seat], 0);
  if (!sum) return seats.map((seat) => ({ seat, delta: raw[seat] }));
  const side = sum > 0 ? 1 : -1;
  const totalWinners = seats.reduce((n, seat) => n + Math.max(0, raw[seat] * side), 0);
  const totalLosers = seats.reduce((n, seat) => n + Math.max(0, raw[seat] * -side), 0);
  const source = side > 0 ? 1 : -1;
  const budget = Math.min(totalWinners, totalLosers);
  let allocated = 0, cumulative = 0;
  const results = seats.map((seat) => {
    const amount = raw[seat];
    if (amount * source <= 0) return { seat, delta: amount };
    cumulative += Math.abs(amount);
    const share = Math.floor(cumulative * budget / totalWinners) - allocated;
    allocated += share;
    return { seat, delta: source * share };
  });
  return results;
}

export const baccaratEngine: GameEngine<BaccaratState, BaccaratAction, BaccaratView> = {
  meta: { id: "baccarat", name: "Baccarat", minPlayers: 1, maxPlayers: 12, hasDealer: false, rulesFlags: {} },
  rulesText: RULES,
  init({ seats, baseBet, rng }: { seats: SeatInfo[]; baseBet: number; rng: RNG }) {
    const chips: Record<number, number> = {}, bets: Record<number, BaccaratAction | null> = {};
    for (const seat of seats) { chips[seat.seat] = seat.chips; bets[seat.seat] = null; }
    return { seats: seats.map((s) => s.seat), chips, baseBet, bets, shoe: shuffle(rng, Array.from({ length: 8 }, () => makeDeck()).flat()), hand: null };
  },
  toAct(s) { return s.hand ? [] : s.seats.filter((seat) => !s.bets[seat]); },
  legalActions(s, seat) {
    if (!this.toAct(s).includes(seat)) return [];
    const amount = Math.min(s.baseBet, s.chips[seat] ?? 0);
    return amount > 0 ? SIDES.map((side) => ({ type: "bet" as const, side, amount })) : [];
  },
  apply(s, seat, action) {
    if (!this.toAct(s).includes(seat)) return { error: "Chưa đến lượt" };
    if (action?.type !== "bet" || !SIDES.includes(action.side) || !Number.isSafeInteger(action.amount) || action.amount < 1 || action.amount > (s.chips[seat] ?? 0)) return { error: "Cược không hợp lệ" };
    const bets = { ...s.bets, [seat]: action };
    if (s.seats.some((player) => !bets[player])) return { state: { ...s, bets } };
    const dealt = deal(s.shoe);
    return { state: { ...s, bets, shoe: dealt.shoe, hand: dealt.hand } };
  },
  view(s, seat) { return { me: seat, bets: s.bets, submitted: s.seats.filter((player) => !!s.bets[player]), hand: s.hand, outcome: s.hand?.winner ?? null }; },
  isOver: (s) => s.hand !== null,
  settle(s): Payout[] {
    if (!s.hand) return [];
    const raw: Record<number, number> = {};
    for (const seat of s.seats) {
      const bet = s.bets[seat]!;
      raw[seat] = bet.side === s.hand.winner ? Math.floor(bet.amount * (bet.side === "banker" ? 0.95 : bet.side === "tie" ? 8 : 1)) : s.hand.winner === "tie" && bet.side !== "tie" ? 0 : -bet.amount;
    }
    return balance(raw, s.seats);
  },
  bot(s, seat, rng) { const legal = this.legalActions(s, seat); return legal[rng.int(legal.length)]!; },
};
export { RULES as baccaratRulesText };
