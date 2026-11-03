import {
  makeDeck, shuffle, settleVsDealer,
  type Card, type GameEngine, type Payout, type RNG,
} from "@cg/shared";

/**
 * Xì Dách (dealer game). Sequential: players act in seat order, then the dealer.
 * Aces count 1, 10 or 11 (best total <= 21). Hands: xì bàng (A+A, 2 cards), ngũ linh (5 cards <= 21),
 * xì dách (A + 10-value, 2 cards), normal points, quắc (> 21).
 */
export type HandKind = "bang" | "linh" | "dach" | "normal" | "bust";
export interface HandCat { kind: HandKind; points: number }
export type XiDachAction = { type: "hit" } | { type: "stand" };
export type Flags = {
  playerMin: number; dealerMin: number;
  xiDachMul: number; xiBangMul: number; nguLinhMul: number;
  nguLinhBeatsXiDach: boolean;
};

export interface XiDachState {
  seats: number[]; // players in act order (dealer excluded)
  dealer: number;
  chips: Record<number, number>;
  baseBet: number;
  flags: Flags;
  deck: Card[];
  hands: Record<number, Card[]>;
  done: number[]; // players who finished (stand / bust / 5 cards / special)
  phase: "players" | "dealer" | "over";
}
export interface XiDachView {
  me: number;
  dealer: number;
  phase: XiDachState["phase"];
  order: number[];
  done: number[];
  counts: Record<number, number>;
  /** own cards always; everyone's when over; otherwise null */
  hands: Record<number, Card[] | null>;
  myPoints: number;
  myKind: HandKind | null;
  /** only when over */
  cats: Record<number, HandCat> | null;
  canStand: boolean;
  canHit: boolean;
}

const DEFAULT_FLAGS: Flags = {
  playerMin: 16, dealerMin: 15, xiDachMul: 2, xiBangMul: 3, nguLinhMul: 3, nguLinhBeatsXiDach: true,
};

const RULES = `Xì Dách (có nhà cái). Dùng bộ bài 52 lá, mỗi người nhận 2 lá.
Điểm: 2-10 tính theo số; J, Q, K = 10; Át (A) tính 1, 10 hoặc 11 tuỳ có lợi nhất (tối đa 21).
Bài đặc biệt (từ cao xuống thấp): Xì bàng (2 lá đều là Át) > Ngũ linh (5 lá, tổng không quá 21) > Xì dách (Át + lá 10 điểm, 2 lá) > điểm thường (21 → 2). Quá 21 điểm là "quắc" và thua.
Thưởng: Xì dách thắng x2, Xì bàng x3, Ngũ linh x3, điểm thường x1 (nhân với mức cược bàn).
Cách chơi: người chơi lần lượt "Rút" thêm lá hoặc "Dừng". Chỉ được dừng khi từ 16 điểm; dưới 16 phải rút. Tối đa 5 lá. Nhà cái phải có từ 15 điểm mới được dừng. Nếu nhà cái có Xì dách hoặc Xì bàng ngay từ đầu, ván kết thúc và so bài luôn.
So bài: người quắc thua cái. Cái quắc thì trả cho mọi người không quắc. Còn lại so bài đặc biệt rồi so điểm, bằng nhau là hoà. Nhà cái chỉ đền tối đa số chip mình có. Chỉ dùng chip ảo, chơi giải trí, không dùng tiền thật.`;

// ---------- hand maths ----------
const val = (c: Card) => (c.rank === 1 ? 1 : Math.min(c.rank, 10));

export function minTotal(h: Card[]): number {
  return h.reduce((a, c) => a + val(c), 0);
}

/** Best total <= 21 with each ace worth 1, 10 or 11; if none fits, the minimum (bust). */
export function points(h: Card[]): number {
  const aces = h.filter((c) => c.rank === 1).length;
  const base = h.reduce((a, c) => a + (c.rank === 1 ? 0 : val(c)), 0);
  let best = -1;
  for (let a11 = 0; a11 <= aces; a11++)
    for (let a10 = 0; a10 + a11 <= aces; a10++) {
      const t = base + a11 * 11 + a10 * 10 + (aces - a11 - a10);
      if (t <= 21 && t > best) best = t;
    }
  return best === -1 ? minTotal(h) : best;
}

export function categorize(h: Card[]): HandCat {
  const min = minTotal(h);
  if (min > 21) return { kind: "bust", points: min };
  if (h.length === 2) {
    const aces = h.filter((c) => c.rank === 1).length;
    if (aces === 2) return { kind: "bang", points: 21 };
    if (aces === 1 && h.some((c) => c.rank >= 10)) return { kind: "dach", points: 21 };
  }
  if (h.length === 5) return { kind: "linh", points: points(h) };
  return { kind: "normal", points: points(h) };
}

function rank(k: HandKind, f: Flags): number {
  switch (k) {
    case "bang": return 4;
    case "linh": return f.nguLinhBeatsXiDach ? 3 : 2;
    case "dach": return f.nguLinhBeatsXiDach ? 2 : 3;
    case "normal": return 1;
    default: return 0;
  }
}
function mult(k: HandKind, f: Flags): number {
  return k === "bang" ? f.xiBangMul : k === "linh" ? f.nguLinhMul : k === "dach" ? f.xiDachMul : 1;
}

/** >0 player wins (amount = +bet*mult), <0 dealer wins, 0 tie. Returns signed chips in bet units. */
export function compare(p: HandCat, d: HandCat, f: Flags): number {
  if (p.kind === "bust") return -1;
  if (d.kind === "bust") return mult(p.kind, f);
  const rp = rank(p.kind, f), rd = rank(d.kind, f);
  if (rp > rd) return mult(p.kind, f);
  if (rp < rd) return -mult(d.kind, f);
  if (p.kind === "normal" || p.kind === "linh") {
    if (p.points > d.points) return mult(p.kind, f);
    if (p.points < d.points) return -mult(d.kind, f);
  }
  return 0;
}

// ---------- state machine ----------
function draw(s: XiDachState, seat: number): XiDachState {
  const deck = s.deck.slice();
  const card = deck.pop()!;
  return { ...s, deck, hands: { ...s.hands, [seat]: [...s.hands[seat]!, card] } };
}

/** Auto-finish players (bust / 5 cards / special at deal), move phases, end the hand. */
export function normalize(s: XiDachState): XiDachState {
  if (s.phase === "over") return s;
  const dk = categorize(s.hands[s.dealer]!);
  if (s.hands[s.dealer]!.length === 2 && (dk.kind === "bang" || dk.kind === "dach")) return { ...s, phase: "over" };
  let done = s.done;
  for (const seat of s.seats) {
    if (done.includes(seat)) continue;
    const h = s.hands[seat]!;
    const k = categorize(h).kind;
    if (k === "bust" || h.length >= 5 || (h.length === 2 && (k === "bang" || k === "dach"))) done = [...done, seat];
  }
  let phase: XiDachState["phase"] = s.phase;
  if (phase === "players" && s.seats.every((x) => done.includes(x))) phase = "dealer";
  if (phase === "dealer") {
    const dh = s.hands[s.dealer]!;
    if (categorize(dh).kind === "bust" || dh.length >= 5) phase = "over";
  }
  return { ...s, done, phase };
}

const hasLegal = (s: XiDachState, seat: number, t: XiDachAction["type"]) => {
  const h = s.hands[seat]!;
  const min = seat === s.dealer ? s.flags.dealerMin : s.flags.playerMin;
  if (t === "hit") return h.length < 5 && minTotal(h) < 21 && points(h) < 21;
  return points(h) >= min && minTotal(h) <= 21;
};

export const xiDachEngine: GameEngine<XiDachState, XiDachAction, XiDachView> = {
  meta: { id: "xi-dach", name: "Xì Dách", minPlayers: 2, maxPlayers: 8, hasDealer: true, rulesFlags: { ...DEFAULT_FLAGS } },
  rulesText: RULES,

  init({ seats, dealerSeat, baseBet, rng, flags }: { seats: { seat: number; chips: number }[]; dealerSeat?: number; baseBet: number; rng: RNG; flags: Record<string, boolean | number> }) {
    const dealer = dealerSeat ?? seats[0]!.seat;
    const players = seats.map((x) => x.seat).filter((x) => x !== dealer);
    const chips: Record<number, number> = {};
    for (const x of seats) chips[x.seat] = x.chips;
    const deck = shuffle(rng, makeDeck());
    const hands: Record<number, Card[]> = {};
    for (const x of [...players, dealer]) hands[x] = [];
    for (let r = 0; r < 2; r++) for (const x of [...players, dealer]) hands[x]!.push(deck.pop()!);
    const f = { ...DEFAULT_FLAGS, ...(flags as Partial<Flags>) };
    return normalize({ seats: players, dealer, chips, baseBet, flags: f, deck, hands, done: [], phase: "players" });
  },

  toAct(s) {
    if (s.phase === "over") return [];
    if (s.phase === "dealer") return [s.dealer];
    const next = s.seats.find((x) => !s.done.includes(x));
    return next === undefined ? [] : [next];
  },

  legalActions(s, seat) {
    if (!this.toAct(s).includes(seat)) return [];
    const out: XiDachAction[] = [];
    if (hasLegal(s, seat, "hit")) out.push({ type: "hit" });
    if (hasLegal(s, seat, "stand")) out.push({ type: "stand" });
    return out;
  },

  apply(s, seat, a) {
    if (!this.toAct(s).includes(seat)) return { error: "Chưa đến lượt" };
    if (a?.type === "hit") {
      if (!hasLegal(s, seat, "hit")) return { error: "Không thể rút thêm" };
      return { state: normalize(draw(s, seat)) };
    }
    if (a?.type === "stand") {
      if (!hasLegal(s, seat, "stand")) return { error: `Cần từ ${seat === s.dealer ? s.flags.dealerMin : s.flags.playerMin} điểm mới được dừng` };
      if (seat === s.dealer) return { state: { ...s, phase: "over" } };
      return { state: normalize({ ...s, done: [...s.done, seat] }) };
    }
    return { error: "Hành động không hợp lệ" };
  },

  view(s, seat) {
    const over = s.phase === "over";
    const all = [...s.seats, s.dealer];
    const hands: Record<number, Card[] | null> = {};
    const counts: Record<number, number> = {};
    for (const x of all) {
      counts[x] = s.hands[x]!.length;
      hands[x] = over || x === seat ? s.hands[x]! : null;
    }
    const mine = s.hands[seat];
    const acting = this.toAct(s).includes(seat);
    const cats: Record<number, HandCat> = {};
    if (over) for (const x of all) cats[x] = categorize(s.hands[x]!);
    return {
      me: seat, dealer: s.dealer, phase: s.phase, order: s.seats, done: s.done, counts, hands,
      myPoints: mine ? points(mine) : 0,
      myKind: mine ? categorize(mine).kind : null,
      cats: over ? cats : null,
      canHit: acting && hasLegal(s, seat, "hit"),
      canStand: acting && hasLegal(s, seat, "stand"),
    };
  },

  isOver: (s) => s.phase === "over",

  settle(s): Payout[] {
    const d = categorize(s.hands[s.dealer]!);
    const results = s.seats.map((seat) => {
      const m = compare(categorize(s.hands[seat]!), d, s.flags);
      return { seat, amount: m * s.baseBet };
    });
    return settleVsDealer(s.dealer, s.chips[s.dealer] ?? 0, s.chips, results);
  },

  bot(s, seat, rng) {
    const legal = this.legalActions(s, seat);
    const pts = points(s.hands[seat]!);
    const hit = legal.find((x) => x.type === "hit");
    const stand = legal.find((x) => x.type === "stand");
    if (!stand) return hit!;
    if (!hit) return stand;
    const limit = seat === s.dealer ? 17 : 16 + (rng.next() < 0.3 ? 1 : 0);
    return pts < limit ? hit : stand;
  },

  /** Human timed out: stand if allowed, otherwise the forced hit. */
  timeoutAction(s, seat) {
    const legal = this.legalActions(s, seat);
    return legal.find((x) => x.type === "stand") ?? legal[0]!;
  },
};
