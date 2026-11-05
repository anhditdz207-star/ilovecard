import { makeDeck, shuffle, type Card, type GameEngine, type InitConfig, type Payout, type RNG } from "@cg/shared";

/**
 * Bài cào tố: 3 cards each, no dealer. Everyone antes baseBet, looks at own cards, then one betting round
 * (check / call / raise / fold) until all remaining players have matched. Then showdown ("lật bài").
 * Total bet per player is capped at the smallest stack at the table, so there are no side pots.
 */
export type BCTAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; to: number };

export interface BCTFlags { maxRaises: number; tieBreakByCard: boolean }
export interface BCTState {
  seats: number[];
  hands: Record<number, Card[]>;
  chips: Record<number, number>;
  baseBet: number;
  flags: BCTFlags;
  committed: Record<number, number>;
  folded: number[];
  acted: number[];
  currentBet: number;
  lastRaise: number;
  raises: number;
  cap: number;
  current: number;
  over: boolean;
  showdown: boolean;
}
export interface BCTHandInfo { points: number; baTay: boolean; label: string }
export interface BCTView {
  me: number;
  order: number[];
  current: number;
  myHand: Card[];
  myInfo: BCTHandInfo;
  committed: Record<number, number>;
  pot: number;
  currentBet: number;
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  folded: number[];
  raisesLeft: number;
  over: boolean;
  showdown: boolean;
  /** revealed only at showdown (non-folded players) */
  hands: Record<number, Card[]> | null;
  infos: Record<number, BCTHandInfo> | null;
  winners: number[] | null;
}

const RULES = `Bài cào tố (3 lá, không có nhà cái, 2-8 người).
Mỗi người góp mức cược gốc vào hũ rồi nhận 3 lá úp, tự xem bài của mình.
Điểm: cộng 3 lá rồi lấy hàng đơn vị (A = 1, 2-9 theo số, 10/J/Q/K = 10 tức 0 điểm). Cao nhất là "Ba tây" (3 lá J, Q, K), sau đó 9 điểm xuống 0 điểm.
Tố bài: lần lượt từng người có thể Theo (bằng mức đang cược), Tố thêm (tăng mức cược), Qua (khi chưa ai tố) hoặc Úp bỏ bài. Ai tố thì những người còn lại phải theo hoặc bỏ. Khi tất cả người còn lại đã cân tiền thì cùng lật bài.
So bài: điểm cao hơn thắng; bằng điểm thì so lá lớn nhất (K > Q > J > 10 > ... > A; chất Cơ > Rô > Chuồn > Bích). Người thắng ăn cả hũ. Nếu tất cả bỏ bài trừ một người thì người đó ăn hũ mà không cần lật bài.
Mức tố tối đa bằng số chip của người ít chip nhất trong bàn, nên không ai bị thiếu tiền để theo. Chỉ dùng chip ảo, chơi giải trí, không dùng tiền thật.`;

// ---------- hand maths ----------
const SUIT_ORDER = { S: 0, C: 1, D: 2, H: 3 } as const;
const cardVal = (c: Card) => c.rank * 4 + SUIT_ORDER[c.suit];
const pt = (c: Card) => (c.rank >= 10 ? 10 : c.rank);

export function handInfo(h: Card[]): BCTHandInfo {
  const baTay = h.length === 3 && h.every((c) => c.rank >= 11);
  const points = h.reduce((a, c) => a + pt(c), 0) % 10;
  return { points, baTay, label: baTay ? "Ba tây" : `${points} điểm` };
}
/** comparable strength: [level, highest card] */
function strength(h: Card[]): [number, number] {
  const i = handInfo(h);
  return [i.baTay ? 10 : i.points, Math.max(...h.map(cardVal))];
}

// ---------- flow helpers ----------
const active = (s: BCTState) => s.seats.filter((x) => !s.folded.includes(x));
const toCallOf = (s: BCTState, seat: number) => s.currentBet - s.committed[seat]!;
const minRaiseTo = (s: BCTState) => Math.min(s.cap, s.currentBet + Math.max(s.lastRaise, s.baseBet));

function nextActor(s: BCTState, from: number): number | null {
  const n = s.seats.length;
  const idx = s.seats.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const cand = s.seats[(idx + k) % n]!;
    if (s.folded.includes(cand)) continue;
    if (!s.acted.includes(cand) || s.committed[cand]! < s.currentBet) return cand;
  }
  return null;
}

function finish(s: BCTState, from: number): BCTState {
  const left = active(s);
  if (left.length <= 1) return { ...s, over: true, showdown: false };
  const nx = nextActor(s, from);
  if (nx === null) return { ...s, over: true, showdown: true };
  return { ...s, current: nx };
}

function winnersOf(s: BCTState): number[] {
  const left = active(s);
  if (!s.showdown || left.length === 1) return left.slice(0, 1);
  const st = left.map((x) => ({ seat: x, s: strength(s.hands[x]!) }));
  const bestLevel = Math.max(...st.map((x) => x.s[0]));
  let top = st.filter((x) => x.s[0] === bestLevel);
  if (s.flags.tieBreakByCard) {
    const bestCard = Math.max(...top.map((x) => x.s[1]));
    top = top.filter((x) => x.s[1] === bestCard);
  }
  return top.map((x) => x.seat);
}

export const baiCaoToEngine: GameEngine<BCTState, BCTAction, BCTView> = {
  meta: { id: "bai-cao-to", name: "Bài Cào Tố", minPlayers: 2, maxPlayers: 8, hasDealer: false, rulesFlags: { maxRaises: 4, tieBreakByCard: true } },
  rulesText: RULES,

  init(cfg: InitConfig) {
    const seats = cfg.seats.map((x) => x.seat).sort((a, b) => a - b);
    const flags = { maxRaises: 4, tieBreakByCard: true, ...(cfg.flags as Partial<BCTFlags>) };
    const chips: Record<number, number> = {};
    for (const x of cfg.seats) chips[x.seat] = x.chips;
    const deck = shuffle(cfg.rng, makeDeck());
    const hands: Record<number, Card[]> = {};
    const committed: Record<number, number> = {};
    for (const seat of seats) { hands[seat] = deck.splice(0, 3); committed[seat] = cfg.baseBet; }
    const cap = Math.min(...seats.map((x) => chips[x]!));
    return {
      seats, hands, chips, baseBet: cfg.baseBet, flags, committed, folded: [], acted: [], currentBet: cfg.baseBet,
      lastRaise: cfg.baseBet, raises: 0, cap, current: seats[cfg.rng.int(seats.length)]!, over: false, showdown: false,
    };
  },

  toAct: (s) => (s.over ? [] : [s.current]),

  legalActions(s, seat) {
    if (s.over || seat !== s.current) return [];
    const out: BCTAction[] = [{ type: "fold" }];
    if (toCallOf(s, seat) === 0) out.push({ type: "check" });
    else out.push({ type: "call" });
    if (s.raises < s.flags.maxRaises && s.cap > s.currentBet) {
      const lo = minRaiseTo(s);
      out.push({ type: "raise", to: lo });
      if (s.cap > lo) out.push({ type: "raise", to: s.cap });
    }
    return out;
  },

  apply(s, seat, a) {
    if (s.over || seat !== s.current) return { error: "Chưa đến lượt" };
    const need = toCallOf(s, seat);
    switch (a?.type) {
      case "fold":
        return { state: finish({ ...s, folded: [...s.folded, seat] }, seat) };
      case "check":
        if (need !== 0) return { error: "Không thể qua, cần theo hoặc bỏ" };
        return { state: finish({ ...s, acted: [...s.acted, seat] }, seat) };
      case "call":
        if (need === 0) return { error: "Không có gì để theo" };
        return { state: finish({ ...s, committed: { ...s.committed, [seat]: s.currentBet }, acted: [...s.acted, seat] }, seat) };
      case "raise": {
        const to = a.to;
        if (!Number.isSafeInteger(to)) return { error: "Số tiền không hợp lệ" };
        if (s.raises >= s.flags.maxRaises) return { error: "Đã hết số lần tố" };
        if (to > s.cap) return { error: `Tối đa ${s.cap}` };
        if (to <= s.currentBet) return { error: "Phải tố cao hơn mức hiện tại" };
        if (to < minRaiseTo(s)) return { error: `Tối thiểu ${minRaiseTo(s)}` };
        const next: BCTState = {
          ...s, committed: { ...s.committed, [seat]: to }, currentBet: to, lastRaise: to - s.currentBet,
          raises: s.raises + 1, acted: [seat],
        };
        return { state: finish(next, seat) };
      }
      default:
        return { error: "Hành động không hợp lệ" };
    }
  },

  view(s, seat) {
    const left = active(s);
    const reveal = s.over && s.showdown;
    const hands: Record<number, Card[]> = {};
    const infos: Record<number, BCTHandInfo> = {};
    if (reveal) for (const x of left) { hands[x] = s.hands[x]!; infos[x] = handInfo(s.hands[x]!); }
    const me = s.hands[seat] ?? [];
    const myTurn = !s.over && s.current === seat;
    const canRaise = myTurn && s.raises < s.flags.maxRaises && s.cap > s.currentBet;
    return {
      me: seat, order: s.seats, current: s.current, myHand: me, myInfo: handInfo(me),
      committed: s.committed, pot: Object.values(s.committed).reduce((a, b) => a + b, 0), currentBet: s.currentBet,
      toCall: s.committed[seat] === undefined ? 0 : toCallOf(s, seat), minRaiseTo: minRaiseTo(s), maxRaiseTo: s.cap,
      canCheck: myTurn && toCallOf(s, seat) === 0, canCall: myTurn && toCallOf(s, seat) > 0, canRaise,
      folded: s.folded, raisesLeft: s.flags.maxRaises - s.raises, over: s.over, showdown: s.showdown,
      hands: reveal ? hands : null, infos: reveal ? infos : null, winners: s.over ? winnersOf(s) : null,
    };
  },

  isOver: (s) => s.over,

  settle(s): Payout[] {
    const w = winnersOf(s);
    const pot = Object.values(s.committed).reduce((a, b) => a + b, 0);
    const share = Math.floor(pot / w.length);
    let rest = pot - share * w.length;
    return s.seats.map((seat) => {
      let delta = -s.committed[seat]!;
      if (w.includes(seat)) {
        delta += share + (rest > 0 && seat === w[0] ? rest : 0);
        if (seat === w[0]) rest = 0;
      }
      return { seat, delta };
    });
  },

  bot(s, seat, rng: RNG) {
    const need = toCallOf(s, seat);
    const [level] = strength(s.hands[seat]!);
    const canRaise = s.raises < s.flags.maxRaises && s.cap > s.currentBet;
    const raiseTo = (frac: number) => {
      const lo = minRaiseTo(s);
      return Math.max(lo, Math.min(s.cap, Math.floor(s.currentBet + (s.cap - s.currentBet) * frac)));
    };
    const strong = level >= 8;
    const mid = level >= 5;
    if (canRaise && (strong ? rng.next() < 0.7 : level >= 6 && rng.next() < 0.2 || rng.next() < 0.05)) {
      return { type: "raise", to: raiseTo(strong ? 0.3 + rng.next() * 0.4 : 0) };
    }
    if (need === 0) return { type: "check" };
    const price = need / Math.max(1, s.baseBet);
    if (strong || (mid && price <= 4) || (!mid && price <= 1 && rng.next() < 0.5) || rng.next() < 0.08) return { type: "call" };
    return { type: "fold" };
  },

  /** human timeout: check if free, else fold */
  timeoutAction(s, seat) {
    return toCallOf(s, seat) === 0 ? { type: "check" } : { type: "fold" };
  },
};
