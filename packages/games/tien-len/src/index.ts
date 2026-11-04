import {
  makeDeck, shuffle, settleNet,
  type Card, type GameEngine, type InitConfig, type Payout, type RNG,
} from "@cg/shared";

/**
 * Tiến lên (no dealer, 2-4 players, 13 cards each). One rules engine, two games (Nam / Bắc) differing by flags.
 * Order: 3<4<...<K<A<2, suits ♠<♣<♦<♥. Combos: single, pair, triple, quad (tứ quý), straight (>=3, no 2),
 * pairs (đôi thông, >=3 consecutive pairs, no 2).
 */
export type ComboType = "single" | "pair" | "triple" | "quad" | "straight" | "pairs";
export interface Combo { type: ComboType; n: number; top: number; r: number }
export type TLAction = { type: "play"; cards: Card[] } | { type: "pass" };

export interface TLFlags {
  chatChong: boolean;   // a chặt can be re-chặt by a higher chặt
  chatHeo: boolean;     // chặt heo pays money (black 2 = 1 bet, red 2 = 2 bets)
  thoiHeo: boolean;     // last place pays winner for 2s still in hand
  cong: number;         // bets a player who never played pays the winner (0 = off)
  toiTrang: boolean;    // instant win at deal (sảnh rồng, tứ quý heo, 6 đôi)
  toiTrangUnits: number; // bets each opponent pays on tới trắng
  first3: boolean;      // first play must contain the lowest dealt card (3♠)
}
export interface TLState {
  seats: number[];
  hands: Record<number, Card[]>;
  chips: Record<number, number>;
  baseBet: number;
  flags: TLFlags;
  current: number;
  lead: { seat: number; cards: Card[]; combo: Combo } | null;
  passed: number[];
  finished: number[];
  played: Record<number, number>;
  lowest: Card;
  firstDone: boolean;
  lastIsChop: boolean;
  lastChop: { owner: number; chopper: number; units: number } | null;
  chops: { from: number; to: number; units: number }[];
  white: { seat: number; kind: "rong" | "tuQuyHeo" | "sauDoi" } | null;
  over: boolean;
}
export interface TLView {
  me: number;
  hand: Card[];
  counts: Record<number, number>;
  order: number[];
  current: number;
  lead: { seat: number; cards: Card[]; type: ComboType } | null;
  passed: number[];
  finished: number[];
  canPass: boolean;
  /** card the very first play must contain, else null */
  mustInclude: Card | null;
  over: boolean;
  white: TLState["white"];
  /** everyone's remaining cards, only when over */
  hands: Record<number, Card[]> | null;
}

// ---------- ordering & combos ----------
const SUIT = { S: 0, C: 1, D: 2, H: 3 } as const;
export const rankOrder = (rank: number) => (rank === 1 ? 11 : rank === 2 ? 12 : rank - 3);
export const cval = (c: Card) => rankOrder(c.rank) * 4 + SUIT[c.suit];
const byVal = (a: Card, b: Card) => cval(a) - cval(b);
const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

export function analyze(cards: Card[]): Combo | null {
  const n = cards.length;
  if (!n) return null;
  const s = [...cards].sort(byVal);
  const ranks = s.map((c) => rankOrder(c.rank));
  const top = cval(s[n - 1]!);
  const r = ranks[n - 1]!;
  if (ranks.every((x) => x === ranks[0])) {
    const t: Record<number, ComboType> = { 1: "single", 2: "pair", 3: "triple", 4: "quad" };
    return t[n] ? { type: t[n]!, n, top, r } : null;
  }
  if (n >= 3 && new Set(ranks).size === n && r <= 11 && r - ranks[0]! === n - 1) return { type: "straight", n, top, r };
  if (n >= 6 && n % 2 === 0 && r <= 11) {
    let ok = true;
    for (let i = 0; i < n / 2; i++) {
      if (ranks[2 * i] !== ranks[2 * i + 1]) ok = false;
      if (i > 0 && ranks[2 * i] !== ranks[2 * i - 2]! + 1) ok = false;
    }
    if (ok) return { type: "pairs", n, top, r };
  }
  return null;
}

/** 0 = not a chặt; higher beats lower: 3 đôi thông < tứ quý < 4 đôi thông < 5 < 6 */
export function chopLevel(c: Combo): number {
  if (c.type === "pairs") return c.n === 6 ? 1 : c.n === 8 ? 3 : c.n === 10 ? 4 : 5;
  if (c.type === "quad") return 2;
  return 0;
}
const isTwoCombo = (c: Combo) => c.r === 12 && (c.type === "single" || c.type === "pair" || c.type === "triple");

export function beats(prev: Combo, cur: Combo, ctx: { lastIsChop: boolean; chatChong: boolean }): boolean {
  if (cur.type === prev.type && cur.n === prev.n) return cur.top > prev.top;
  if (prev.type === "single" && prev.r === 12) return chopLevel(cur) >= 1;
  if (prev.type === "pair" && prev.r === 12) return cur.type === "quad" || chopLevel(cur) >= 3;
  if (ctx.lastIsChop && ctx.chatChong && chopLevel(prev) > 0 && chopLevel(cur) > 0) return chopLevel(cur) > chopLevel(prev);
  return false;
}

const twoUnits = (cards: Card[]) => cards.reduce((a, c) => a + (c.suit === "D" || c.suit === "H" ? 2 : 1), 0);

export function whiteKind(hand: Card[]): "rong" | "tuQuyHeo" | "sauDoi" | null {
  const cnt: Record<number, number> = {};
  for (const c of hand) cnt[rankOrder(c.rank)] = (cnt[rankOrder(c.rank)] ?? 0) + 1;
  if ((cnt[12] ?? 0) === 4) return "tuQuyHeo";
  if (Array.from({ length: 12 }, (_, i) => cnt[i] ?? 0).every((x) => x >= 1)) return "rong";
  if (Object.values(cnt).reduce((a, x) => a + Math.floor(x / 2), 0) >= 6) return "sauDoi";
  return null;
}

// ---------- move generation (canonical: non-top cards use lowest suit) ----------
function combos<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  arr.forEach((x, i) => combos(arr.slice(i + 1), k - 1).forEach((rest) => out.push([x, ...rest])));
  return out;
}
export function generateMoves(hand: Card[]): Card[][] {
  const g: Card[][] = Array.from({ length: 13 }, () => []);
  for (const c of [...hand].sort(byVal)) g[rankOrder(c.rank)]!.push(c);
  const out: Card[][] = [];
  for (let r = 0; r < 13; r++) for (let k = 1; k <= 4; k++) if (g[r]!.length >= k) out.push(...combos(g[r]!, k));
  for (let a = 0; a <= 9; a++) {
    for (let b = a + 2; b <= 11; b++) {
      let ok = true;
      for (let r = a; r <= b; r++) if (!g[r]!.length) ok = false;
      if (!ok) break;
      const base = [];
      for (let r = a; r < b; r++) base.push(g[r]![0]!);
      for (const t of g[b]!) out.push([...base, t]);
    }
    for (let b = a + 2; b <= 11; b++) {
      let ok = true;
      for (let r = a; r <= b; r++) if (g[r]!.length < 2) ok = false;
      if (!ok) break;
      const base: Card[] = [];
      for (let r = a; r < b; r++) base.push(g[r]![0]!, g[r]![1]!);
      for (const p of combos(g[b]!, 2)) out.push([...base, ...p]);
    }
  }
  return out;
}

function legalPlays(s: TLState, seat: number): Card[][] {
  const hand = s.hands[seat]!;
  const needLow = !s.firstDone && s.flags.first3;
  return generateMoves(hand).filter((m) => {
    const c = analyze(m);
    if (!c) return false;
    if (needLow && !m.some((x) => same(x, s.lowest))) return false;
    return s.lead ? beats(s.lead.combo, c, { lastIsChop: s.lastIsChop, chatChong: s.flags.chatChong }) : true;
  });
}

// ---------- flow ----------
function advance(s: TLState, from: number): TLState {
  const n = s.seats.length;
  const idx = s.seats.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const cand = s.seats[(idx + k) % n]!;
    if (s.finished.includes(cand)) continue;
    if (s.lead && cand === s.lead.seat) return { ...s, lead: null, passed: [], current: cand, lastIsChop: false, lastChop: null };
    if (!s.passed.includes(cand)) return { ...s, current: cand };
  }
  // all remaining passed and the leader already finished: next active player after the leader starts
  const li = s.seats.indexOf(s.lead!.seat);
  for (let k = 1; k <= n; k++) {
    const cand = s.seats[(li + k) % n]!;
    if (!s.finished.includes(cand)) return { ...s, lead: null, passed: [], current: cand, lastIsChop: false, lastChop: null };
  }
  return s;
}

function conclude(s: TLState): TLState {
  const active = s.seats.filter((x) => !s.finished.includes(x));
  if (active.length <= 1) return { ...s, finished: [...s.finished, ...active], over: true };
  return s;
}

const NET: Record<number, number[]> = { 2: [1, -1], 3: [2, 0, -2], 4: [3, 1, -1, -3] };

function makeEngine(id: "tien-len-nam" | "tien-len-bac", name: string, rules: string, defaults: TLFlags): GameEngine<TLState, TLAction, TLView> {
  return {
    meta: { id, name, minPlayers: 2, maxPlayers: 4, hasDealer: false, rulesFlags: { ...defaults } },
    rulesText: rules,

    init(cfg: InitConfig) {
      const seats = cfg.seats.map((x) => x.seat).sort((a, b) => a - b);
      const flags = { ...defaults, ...(cfg.flags as Partial<TLFlags>) };
      const deck = shuffle(cfg.rng, makeDeck());
      const hands: Record<number, Card[]> = {};
      const chips: Record<number, number> = {};
      const played: Record<number, number> = {};
      for (const x of cfg.seats) chips[x.seat] = x.chips;
      for (const seat of seats) { hands[seat] = deck.splice(0, 13).sort(byVal); played[seat] = 0; }
      const all = seats.flatMap((x) => hands[x]!).sort(byVal);
      const lowest = all[0]!;
      const start = seats.find((x) => hands[x]!.some((c) => same(c, lowest)))!;
      let s: TLState = {
        seats, hands, chips, baseBet: cfg.baseBet, flags, current: start, lead: null, passed: [], finished: [], played,
        lowest, firstDone: false, lastIsChop: false, lastChop: null, chops: [], white: null, over: false,
      };
      if (flags.toiTrang) {
        const si = seats.indexOf(start);
        for (let k = 0; k < seats.length; k++) {
          const seat = seats[(si + k) % seats.length]!;
          const kind = whiteKind(hands[seat]!);
          if (kind) {
            s = { ...s, white: { seat, kind }, finished: [seat, ...seats.filter((x) => x !== seat)], over: true };
            break;
          }
        }
      }
      return s;
    },

    toAct: (s) => (s.over ? [] : [s.current]),

    legalActions(s, seat) {
      if (s.over || seat !== s.current) return [];
      const acts: TLAction[] = legalPlays(s, seat).map((cards) => ({ type: "play", cards }));
      if (s.lead) acts.push({ type: "pass" });
      return acts;
    },

    apply(s, seat, a) {
      if (s.over || seat !== s.current) return { error: "Chưa đến lượt" };
      if (a?.type === "pass") {
        if (!s.lead) return { error: "Bạn đang đi đầu, phải đánh bài" };
        return { state: conclude(advance({ ...s, passed: [...s.passed, seat] }, seat)) };
      }
      if (a?.type !== "play" || !Array.isArray(a.cards)) return { error: "Hành động không hợp lệ" };
      const hand = s.hands[seat]!;
      const cards = a.cards;
      if (!cards.length || cards.some((c, i) => !hand.some((h) => same(h, c)) || cards.findIndex((d) => same(d, c)) !== i))
        return { error: "Lá bài không có trong tay" };
      const combo = analyze(cards);
      if (!combo) return { error: "Bộ bài không hợp lệ" };
      if (!s.firstDone && s.flags.first3 && !cards.some((c) => same(c, s.lowest))) return { error: "Nước đầu tiên phải có lá bé nhất (3♠)" };
      if (s.lead && !beats(s.lead.combo, combo, { lastIsChop: s.lastIsChop, chatChong: s.flags.chatChong }))
        return { error: "Bài không đủ mạnh để chặn" };

      let chops = s.chops;
      let lastChop = s.lastChop;
      let lastIsChop = false;
      if (s.lead && isTwoCombo(s.lead.combo) && chopLevel(combo) > 0) {
        const units = twoUnits(s.lead.cards);
        if (s.flags.chatHeo) chops = [...chops, { from: s.lead.seat, to: seat, units }];
        lastChop = { owner: s.lead.seat, chopper: seat, units };
        lastIsChop = true;
      } else if (s.lead && s.lastIsChop && s.flags.chatChong && s.lastChop && chopLevel(s.lead.combo) > 0 && chopLevel(combo) > 0) {
        const lc = s.lastChop;
        if (s.flags.chatHeo) {
          const i = chops.findIndex((c) => c.from === lc.owner && c.to === lc.chopper && c.units === lc.units);
          chops = chops.filter((_, k) => k !== i);
          chops = [...chops, { from: lc.owner, to: seat, units: lc.units }, { from: lc.chopper, to: seat, units: lc.units }];
        }
        lastChop = { owner: lc.owner, chopper: seat, units: lc.units };
        lastIsChop = true;
      }
      const left = hand.filter((h) => !cards.some((c) => same(c, h)));
      let next: TLState = {
        ...s, hands: { ...s.hands, [seat]: left }, lead: { seat, cards: [...cards].sort(byVal), combo },
        played: { ...s.played, [seat]: s.played[seat]! + 1 }, firstDone: true, chops, lastChop, lastIsChop,
        finished: left.length === 0 ? [...s.finished, seat] : s.finished,
      };
      next = conclude(next);
      return { state: next.over ? next : advance(next, seat) };
    },

    view(s, seat) {
      const counts: Record<number, number> = {};
      for (const x of s.seats) counts[x] = s.hands[x]!.length;
      return {
        me: seat, hand: s.hands[seat] ?? [], counts, order: s.seats, current: s.current,
        lead: s.lead ? { seat: s.lead.seat, cards: s.lead.cards, type: s.lead.combo.type } : null,
        passed: s.passed, finished: s.finished, canPass: !s.over && s.current === seat && !!s.lead,
        mustInclude: !s.firstDone && s.flags.first3 && !s.over ? s.lowest : null,
        over: s.over, white: s.white, hands: s.over ? s.hands : null,
      };
    },

    isOver: (s) => s.over,

    settle(s): Payout[] {
      const n = s.seats.length;
      const net: Record<number, number> = {};
      for (const x of s.seats) net[x] = 0;
      const winner = s.finished[0]!;
      if (s.white) {
        for (const x of s.seats) if (x !== winner) { net[x]! -= s.flags.toiTrangUnits; net[winner]! += s.flags.toiTrangUnits; }
      } else {
        const vec = NET[n]!;
        s.finished.forEach((x, i) => { net[x]! += vec[i]!; });
        for (const c of s.chops) { net[c.from]! -= c.units; net[c.to]! += c.units; }
        for (const x of s.seats) {
          if (x === winner) continue;
          if (s.flags.cong > 0 && s.played[x] === 0) { net[x]! -= s.flags.cong; net[winner]! += s.flags.cong; }
          if (s.flags.thoiHeo) {
            const u = twoUnits(s.hands[x]!.filter((c) => c.rank === 2));
            net[x]! -= u; net[winner]! += u;
          }
        }
      }
      for (const x of s.seats) net[x]! *= s.baseBet;
      return settleNet(s.chips, net);
    },

    bot(s, seat, rng: RNG) {
      const plays = legalPlays(s, seat);
      const hand = s.hands[seat]!;
      if (!plays.length) return { type: "pass" };
      const info = plays.map((cards) => ({ cards, c: analyze(cards)! }));
      if (!s.lead) {
        let best = info[0]!, bestScore = -1e9;
        for (const m of info) {
          const score = m.c.n * 10 - m.c.r * 2 - (m.c.r === 12 ? 40 : 0) - (chopLevel(m.c) > 0 ? 25 : 0) + (m.c.type === "single" ? -6 : 0);
          if (score > bestScore || (score === bestScore && m.c.top < best.c.top)) { best = m; bestScore = score; }
        }
        return { type: "play", cards: best.cards };
      }
      const lowest = (arr: typeof info) => arr.reduce((a, b) => (b.c.top < a.c.top ? b : a));
      const plain = info.filter((m) => m.c.r !== 12 && chopLevel(m.c) === 0);
      if (plain.length) return { type: "play", cards: lowest(plain).cards };
      const prevTwo = isTwoCombo(s.lead.combo);
      const chops = info.filter((m) => chopLevel(m.c) > 0);
      if (prevTwo && chops.length) return { type: "play", cards: chops.reduce((a, b) => (chopLevel(b.c) < chopLevel(a.c) ? b : a)).cards };
      if (hand.length <= 4 || rng.next() < 0.25) return { type: "play", cards: lowest(info).cards };
      return { type: "pass" };
    },

    /** human timeout: pass if possible, else play the lowest single */
    timeoutAction(s, seat) {
      if (s.lead) return { type: "pass" };
      const plays = legalPlays(s, seat).filter((m) => m.length === 1);
      const pick = (plays.length ? plays : legalPlays(s, seat)).reduce((a, b) => (cval(b[b.length - 1]!) < cval(a[a.length - 1]!) ? b : a));
      return { type: "play", cards: pick };
    },
  };
}

const COMMON = `Bộ bài 52 lá, mỗi người 13 lá (2-4 người). Thứ tự lá: 3 < 4 < ... < K < A < 2 (heo). Thứ tự chất: Bích < Chuồn < Rô < Cơ.
Các bộ hợp lệ: Lẻ, Đôi, Sám (3 lá), Tứ quý, Sảnh (từ 3 lá liên tiếp, không có 2), Đôi thông (từ 3 đôi liên tiếp, không có 2).
Cách chơi: ván đầu người giữ 3 Bích đi trước và nước đầu phải có lá đó. Người sau phải đánh cùng loại bộ, cùng số lá và lớn hơn (so lá lớn nhất), hoặc bỏ lượt. Đã bỏ lượt là mất quyền trong vòng đó. Khi mọi người bỏ lượt, người đánh cuối được đi đầu vòng mới. Hết bài trước là Nhất; ván chơi đến khi chỉ còn một người.
Chặt: Tứ quý hoặc 3 đôi thông chặt được 1 heo; Tứ quý hoặc 4 đôi thông chặt được đôi heo.
Tới trắng (thắng ngay khi chia bài): Sảnh rồng (3 đến A), Tứ quý heo, hoặc 6 đôi.
Chỉ dùng chip ảo, chơi giải trí, không dùng tiền thật.`;

export const tienLenNamRules = `${COMMON}
LUẬT MIỀN NAM: Chặt chồng (chặt được bài chặt, ví dụ tứ quý chặt 3 đôi thông). Chặt heo ăn tiền: heo đen 1 mức cược, heo đỏ 2 mức. Cóng (không đánh được lá nào) trả thêm 2 mức cho người nhất. Thối heo: người bét còn heo trên tay trả theo số heo. Tính tiền theo thứ hạng: 4 người +3/+1/-1/-3 mức cược; 3 người +2/0/-2; 2 người +1/-1. Tới trắng: mỗi người trả người thắng 3 mức.`;
export const tienLenBacRules = `${COMMON}
LUẬT MIỀN BẮC: Không chặt chồng. Không tính tiền chặt heo, cóng và thối heo; chỉ tính theo thứ hạng: 4 người +3/+1/-1/-3 mức cược; 3 người +2/0/-2; 2 người +1/-1. Tới trắng: mỗi người trả người thắng 3 mức.`;

export const tienLenNamEngine = makeEngine("tien-len-nam", "Tiến Lên Miền Nam", tienLenNamRules, {
  chatChong: true, chatHeo: true, thoiHeo: true, cong: 2, toiTrang: true, toiTrangUnits: 3, first3: true,
});
export const tienLenBacEngine = makeEngine("tien-len-bac", "Tiến Lên Miền Bắc", tienLenBacRules, {
  chatChong: false, chatHeo: false, thoiHeo: false, cong: 0, toiTrang: true, toiTrangUnits: 3, first3: true,
});
