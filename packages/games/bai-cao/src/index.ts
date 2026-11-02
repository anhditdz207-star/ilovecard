import { makeDeck, shuffle, settleVsDealer, type Card, type GameEngine, type Payout, type RNG, type SeatInfo } from "@cg/shared";

export interface BaiCaoState {
  seats: number[]; dealer: number; chips: Record<number, number>; baseBet: number;
  hands: Record<number, Card[]>; revealed: number[];
}
export type BaiCaoAction = { type: "reveal" };
export interface BaiCaoView { me: number; dealer: number; hands: Record<number, Card[] | null>; revealed: number[]; over: boolean; }
const RULES = "Mỗi người được chia 3 lá. Ba lá J, Q, K bất kỳ là Ba Tây và thắng mọi điểm số. Các bộ còn lại tính tổng điểm theo hàng đơn vị (A=1, 2–9 theo số, 10/J/Q/K=0); điểm 0 là bù. So điểm với nhà cái: cao hơn thắng một mức cược, thấp hơn thua một mức cược, bằng điểm thì hòa. Nhà cái trả tối đa số chip mình có. Chỉ dùng chip ảo, chơi giải trí, không dùng tiền thật.";
export const baiCaoPoints = (cards: Card[]) => cards.reduce((sum, card) => sum + (card.rank === 1 ? 1 : card.rank >= 10 ? 0 : card.rank), 0) % 10;
export const isBaTay = (cards: Card[]) => cards.every((card) => card.rank >= 11);
const compare = (a: Card[], b: Card[]) => Number(isBaTay(a)) - Number(isBaTay(b)) || baiCaoPoints(a) - baiCaoPoints(b);

export const baiCaoEngine: GameEngine<BaiCaoState, BaiCaoAction, BaiCaoView> = {
  meta: { id: "bai-cao", name: "Bài Cào (Bài Điểm)", minPlayers: 2, maxPlayers: 12, hasDealer: true, rulesFlags: {} },
  rulesText: RULES,
  init({ seats, dealerSeat, baseBet, rng }: { seats: SeatInfo[]; dealerSeat?: number; baseBet: number; rng: RNG }) {
    const dealer = dealerSeat ?? seats[0]!.seat;
    const order = seats.map((s) => s.seat).filter((seat) => seat !== dealer);
    order.push(dealer);
    const chips: Record<number, number> = {}, hands: Record<number, Card[]> = {};
    for (const seat of seats) chips[seat.seat] = seat.chips;
    const deck = shuffle(rng, makeDeck());
    for (const seat of order) hands[seat] = deck.splice(0, 3);
    return { seats: order, dealer, chips, baseBet, hands, revealed: [] };
  },
  toAct(s) { const next = s.seats.find((seat) => !s.revealed.includes(seat)); return next === undefined ? [] : [next]; },
  legalActions(s, seat) { return this.toAct(s).includes(seat) ? [{ type: "reveal" }] : []; },
  apply(s, seat, action) {
    if (!this.toAct(s).includes(seat)) return { error: "Chưa đến lượt" };
    if (action?.type !== "reveal") return { error: "Lệnh không hợp lệ" };
    return { state: { ...s, revealed: [...s.revealed, seat] } };
  },
  view(s, seat) {
    const hands: Record<number, Card[] | null> = {};
    for (const player of s.seats) hands[player] = player === seat || s.revealed.includes(player) ? s.hands[player]! : null;
    return { me: seat, dealer: s.dealer, hands, revealed: s.revealed, over: this.isOver(s) };
  },
  isOver: (s) => s.revealed.length === s.seats.length,
  settle(s): Payout[] {
    if (!this.isOver(s)) return [];
    const dealerHand = s.hands[s.dealer]!;
    const results = s.seats.filter((seat) => seat !== s.dealer).map((seat) => {
      const diff = compare(s.hands[seat]!, dealerHand);
      return { seat, amount: diff > 0 ? s.baseBet : diff < 0 ? -s.baseBet : 0 };
    });
    return settleVsDealer(s.dealer, s.chips[s.dealer]!, s.chips, results);
  },
  bot: () => ({ type: "reveal" }),
};
export { RULES as baiCaoRulesText };
