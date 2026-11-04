import { useEffect, useState } from "react";
import type { Card, RoomInfo, S2C } from "@cg/shared";
import { analyze, beats, type TLView } from "@cg/game-tien-len";

const suits: Record<Card["suit"], string> = { S: "♠", C: "♣", D: "♦", H: "♥" };
const ranks: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const cardId = (card: Card) => `${card.rank}${card.suit}`;
const cardText = (card: Card) => `${ranks[card.rank] ?? card.rank}${suits[card.suit]}`;
const whiteNames = { rong: "Sảnh rồng", tuQuyHeo: "Tứ quý heo", sauDoi: "6 đôi" } as const;
const medals = ["🥇", "🥈", "🥉"];

export function TienLenTable({ info, data, seat, toAct, result, send, error, deadline }: {
  info: RoomInfo; data: TLView; seat: number; toAct: number[]; result: S2C["result"] | null;
  send: (type: string, extra?: object) => void; error?: string; deadline?: number | null;
}) {
  const [selected, setSelected] = useState<Card[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setSelected((cards) => cards.filter((card) => data.hand.some((inHand) => cardId(inHand) === cardId(card)))); }, [data.hand]);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const current = toAct[0] ?? data.current;
  const acting = toAct.includes(seat) && current === seat;
  const combo = analyze(selected);
  const canBeat = !data.lead || (combo && beats(analyze(data.lead.cards)!, combo, { lastIsChop: false, chatChong: true }));
  const mustInclude = data.mustInclude ? selected.some((card) => cardId(card) === cardId(data.mustInclude!)) : true;
  const playable = acting && !!combo;
  const payout = new Map(result?.payouts.map((p) => [p.seat, p.delta]));
  const toggle = (card: Card) => setSelected((cards) => cards.some((x) => cardId(x) === cardId(card)) ? cards.filter((x) => cardId(x) !== cardId(card)) : [...cards, card]);
  const play = () => send("action", { a: { type: "play", cards: selected } });
  const pass = () => send("action", { a: { type: "pass" } });

  return <main className="relative overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[radial-gradient(ellipse_at_center,_#176348_0%,_#0b382b_56%,_#071e17_100%)] p-4 shadow-2xl sm:p-8">
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(#d7ba6b_0.55px,transparent_0.55px)] [background-size:12px_12px]" />
    <div className="relative mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200/70">{info.gameId === "tien-len-bac" ? "Tiến Lên Miền Bắc" : "Tiến Lên Miền Nam"} · Phòng {info.code}</p><h2 className="text-2xl font-black sm:text-3xl">Bàn Tiến Lên</h2></div><div className="rounded-full border border-amber-200/20 bg-black/20 px-4 py-2 text-sm text-amber-100">Cược bàn <b className="ml-1 text-white">{info.baseBet.toLocaleString()} chip</b></div></header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.order.map((player) => {
          const finishIndex = data.finished.indexOf(player);
          return <article key={player} className={`rounded-2xl border p-3 ${player === current && !data.over ? "border-amber-200/60 bg-amber-300/10 shadow-lg" : "border-white/10 bg-black/15"}`}>
            <div className="flex items-center justify-between gap-2 text-sm"><b>{info.seats[player]?.name ?? `Ghế ${player}`}{player === seat ? " · Bạn" : ""}</b><span>{finishIndex >= 0 ? `${medals[finishIndex] ?? `#${finishIndex + 1}`} ${finishIndex + 1}` : `${data.counts[player]} lá`}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-100/60"><span>{info.seats[player]?.isBot ? "🤖 Máy" : "Người chơi"}</span>{data.passed.includes(player) && <span className="rounded-full bg-white/10 px-2 py-0.5">Bỏ lượt</span>}{!data.over && data.finished.includes(player) && <span>🏁 Đã về</span>}</div>
            {data.over && <div className="mt-3 flex min-h-12 flex-wrap gap-1">{data.hands?.[player]?.map((card) => <span key={cardId(card)} className="rounded bg-white px-1.5 py-1 text-xs font-bold text-slate-900">{cardText(card)}</span>)}</div>}
            {data.over && result && <div className={`mt-2 text-sm font-bold ${(payout.get(player) ?? 0) >= 0 ? "text-amber-200" : "text-rose-300"}`}>{(payout.get(player) ?? 0) > 0 ? "+" : ""}{(payout.get(player) ?? 0).toLocaleString()} chip</div>}
          </article>;
        })}
      </div>

      <section className="my-4 min-h-36 rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-6">
        <div className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-emerald-100/50">Bài trên bàn</div>
        {data.white ? <div className="py-5 text-center text-2xl font-black text-amber-200">Tới trắng! · {whiteNames[data.white.kind]} · {info.seats[data.white.seat]?.name}</div> : data.lead ? <div className="flex flex-wrap items-center justify-center gap-2"><div className="w-full text-center text-sm text-emerald-100/70">{info.seats[data.lead.seat]?.name} đánh {data.lead.type}</div>{data.lead.cards.map((card) => <span key={cardId(card)} className="grid h-16 w-12 place-items-center rounded-lg bg-white text-lg font-black text-slate-900 shadow-lg">{cardText(card)}</span>)}</div> : <p className="py-7 text-center text-sm text-emerald-100/50">Chưa có bộ bài nào · người tới lượt được đi đầu</p>}
      </section>

      {data.over && <div className="mb-4 rounded-2xl bg-amber-300/10 p-3 text-center font-bold text-amber-100">Ván đã kết thúc{result ? " · Chip đã chốt" : " · Đang chốt chip…"}</div>}
      {!data.over && <section className="rounded-3xl border border-white/10 bg-emerald-950/70 p-3 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><b>{acting ? "Bài trên tay" : `Đang tới lượt ${info.seats[current]?.name ?? "người chơi"}`}</b><span className="ml-2 text-xs text-emerald-100/50">{data.hand.length} lá</span></div>{acting && deadline && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Còn {Math.max(0, Math.ceil((deadline - now) / 1000))} giây</span>}</div>
        {data.mustInclude && <p className="mb-2 text-xs text-amber-200">Nước đầu phải có {cardText(data.mustInclude)}</p>}
        <div className="flex min-h-28 flex-wrap items-end gap-1 overflow-x-auto py-2 sm:gap-2">{data.hand.map((card) => { const chosen = selected.some((x) => cardId(x) === cardId(card)); return <button type="button" key={cardId(card)} aria-pressed={chosen} disabled={!acting} onClick={() => toggle(card)} className={`grid h-24 min-w-14 place-items-center rounded-lg border text-xl font-black shadow transition duration-150 sm:h-32 sm:min-w-[4.5rem] ${chosen ? "-translate-y-3 border-amber-200 bg-amber-50 text-slate-900" : "border-slate-200 bg-white text-slate-900 hover:-translate-y-1"} ${(card.suit === "D" || card.suit === "H") ? "text-red-600" : ""}`}><span>{cardText(card)}</span></button>; })}</div>
        {acting && <div className="mt-3 flex flex-wrap items-center gap-2"><button disabled={!playable} onClick={play} className="rounded-xl bg-amber-400 px-5 py-3 font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">Đánh</button><button disabled={!data.canPass} onClick={pass} className="rounded-xl bg-white/10 px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40">Bỏ lượt</button>{combo && !canBeat && <span className="text-xs text-amber-100/80">Bộ này có thể không chặn được lượt trước.</span>}</div>}
        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</p>}
      </section>}
      <p className="mt-4 text-center text-[11px] tracking-wide text-emerald-100/50">Chơi giải trí, không dùng tiền thật</p>
    </div>
  </main>;
}
