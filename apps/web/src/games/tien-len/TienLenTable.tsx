import { useEffect, useRef, useState } from "react";
import type { Card as GameCard, RoomInfo, S2C } from "@cg/shared";
import { analyze, beats, type TLView } from "@cg/game-tien-len";
import { Card } from "../../components/Card";
import { ChipStack } from "../../components/ChipStack";
import { useGameSounds } from "../../hooks/useGameSounds";

const cardId = (card: GameCard) => `${card.rank}${card.suit}`;
const whiteNames = { rong: "Sảnh rồng", tuQuyHeo: "Tứ quý heo", sauDoi: "6 đôi" } as const;
const medals = ["🥇", "🥈", "🥉"];

export function TienLenTable({ info, data, seat, toAct, result, send, error, deadline }: {
  info: RoomInfo; data: TLView; seat: number; toAct: number[]; result: S2C["result"] | null;
  send: (type: string, extra?: object) => void; error?: string; deadline?: number | null;
}) {
  const [selected, setSelected] = useState<GameCard[]>([]);
  const [now, setNow] = useState(Date.now());
  const [chopFlash, setChopFlash] = useState(false);
  const priorLead = useRef<TLView["lead"]>(null);
  const sounds = useGameSounds();
  useEffect(() => { setSelected((cards) => cards.filter((card) => data.hand.some((inHand) => cardId(inHand) === cardId(card)))); }, [data.hand]);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    const before = priorLead.current;
    if (before && data.lead && before.seat !== data.lead.seat && before.cards.some((card) => card.rank === 2) && ["quad", "pairs"].includes(data.lead.type)) {
      setChopFlash(true);
      sounds.chop();
      const timer = setTimeout(() => setChopFlash(false), 520);
      priorLead.current = data.lead;
      return () => clearTimeout(timer);
    }
    priorLead.current = data.lead;
  }, [data.lead]);
  useEffect(() => { if (data.over) sounds.win(); }, [data.over]);
  const current = toAct[0] ?? data.current;
  const acting = toAct.includes(seat) && current === seat;
  const combo = analyze(selected);
  const canBeat = !data.lead || (combo && beats(analyze(data.lead.cards)!, combo, { lastIsChop: false, chatChong: true }));
  const mustInclude = data.mustInclude ? selected.some((card) => cardId(card) === cardId(data.mustInclude!)) : true;
  const playable = acting && !!combo;
  const payout = new Map(result?.payouts.map((p) => [p.seat, p.delta]));
  const toggle = (card: GameCard) => setSelected((cards) => cards.some((x) => cardId(x) === cardId(card)) ? cards.filter((x) => cardId(x) !== cardId(card)) : [...cards, card]);
  const play = () => { sounds.card(); send("action", { a: { type: "play", cards: selected } }); };
  const pass = () => { sounds.pass(); send("action", { a: { type: "pass" } }); };

  return <main className="cg-table p-4 sm:p-8">
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(#d7ba6b_0.55px,transparent_0.55px)] [background-size:12px_12px]" />
    <div className="relative mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200/70">{info.gameId === "tien-len-bac" ? "Tiến Lên Miền Bắc" : "Tiến Lên Miền Nam"} · Phòng {info.code}</p><h2 className="text-2xl font-black sm:text-3xl">Bàn Tiến Lên</h2></div><ChipStack value={info.baseBet} label="Cược bàn" /></header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.order.map((player) => {
          const finishIndex = data.finished.indexOf(player);
          return <article key={player} className={`rounded-2xl border p-3 ${player === current && !data.over ? "border-amber-200/60 bg-amber-300/10 shadow-lg" : "border-white/10 bg-black/15"}`}>
            <div className="flex items-center justify-between gap-2 text-sm"><b>{info.seats[player]?.name ?? `Ghế ${player}`}{player === seat ? " · Bạn" : ""}</b><span>{finishIndex >= 0 ? `${medals[finishIndex] ?? `#${finishIndex + 1}`} ${finishIndex + 1}` : `${data.counts[player]} lá`}</span></div>
            <ChipStack value={info.seats[player]?.chips ?? 0} label="Chip" compact />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-100/60"><span>{info.seats[player]?.isBot ? "🤖 Máy" : "Người chơi"}</span>{data.passed.includes(player) && <span className="cg-pass-pulse rounded-full bg-white/10 px-2 py-0.5">Bỏ lượt</span>}{!data.over && data.finished.includes(player) && <span>🏁 Đã về</span>}</div>
            {data.over && <div className="mt-3 flex min-h-12 flex-wrap gap-1">{data.hands?.[player]?.map((card, index) => <Card key={cardId(card)} card={card} size="sm" delay={index * 28} />)}</div>}
            {data.over && result && <div className={`mt-2 text-sm font-bold ${(payout.get(player) ?? 0) >= 0 ? "text-amber-200" : "text-rose-300"}`}>{(payout.get(player) ?? 0) > 0 ? "+" : ""}{(payout.get(player) ?? 0).toLocaleString()} chip</div>}
          </article>;
        })}
      </div>

      <section key={data.lead ? `${data.lead.seat}-${data.lead.cards.map(cardId).join("-")}` : data.white ? "white" : "empty"} className={`cg-play-area cg-panel my-4 min-h-36 p-4 sm:p-6 ${chopFlash ? "cg-chop-flash" : ""} ${data.over ? "cg-win" : ""}`}>
        <div className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-emerald-100/50">Bài trên bàn</div>
        {data.white ? <div className="py-5 text-center text-2xl font-black text-amber-200">Tới trắng! · {whiteNames[data.white.kind]} · {info.seats[data.white.seat]?.name}</div> : data.lead ? <div className="flex flex-wrap items-center justify-center gap-2"><div className="w-full text-center text-sm text-emerald-100/70">{info.seats[data.lead.seat]?.name} đánh {data.lead.type}</div>{data.lead.cards.map((card, index) => <Card key={cardId(card)} card={card} size="md" delay={index * 35} />)}</div> : <p className="py-7 text-center text-sm text-emerald-100/50">Chưa có bộ bài nào · người tới lượt được đi đầu</p>}
      </section>

      {data.over && <div className="cg-win mb-4 rounded-2xl bg-amber-300/10 p-3 text-center font-bold text-amber-100">Ván đã kết thúc{result ? " · Chip đã chốt" : " · Đang chốt chip…"}</div>}
      {!data.over && <section className="cg-hand-tray border border-white/10 bg-emerald-950/90 p-3 sm:p-5 lg:static">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><b>{acting ? "Bài trên tay" : `Đang tới lượt ${info.seats[current]?.name ?? "người chơi"}`}</b><span className="ml-2 text-xs text-emerald-100/50">{data.hand.length} lá</span></div>{acting && deadline && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Còn {Math.max(0, Math.ceil((deadline - now) / 1000))} giây</span>}</div>
        {data.mustInclude && <div className="mb-2 flex items-center gap-2 text-xs text-amber-200">Nước đầu phải có <Card card={data.mustInclude} size="sm" /></div>}
        <div className="flex min-h-20 items-end gap-1 overflow-x-auto py-2 sm:min-h-28 sm:gap-2">{data.hand.map((card, index) => { const chosen = selected.some((x) => cardId(x) === cardId(card)); return <Card key={cardId(card)} card={card} size="md" delay={index * 22} selected={chosen} disabled={!acting} onClick={() => { sounds.card(); toggle(card); }} />; })}</div>
        {acting && <div className="mt-3 flex flex-wrap items-center gap-2"><button disabled={!playable} onClick={play} className="rounded-xl bg-amber-400 px-5 py-3 font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">Đánh</button><button disabled={!data.canPass} onClick={pass} className="rounded-xl bg-white/10 px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40">Bỏ lượt</button>{combo && !canBeat && <span className="text-xs text-amber-100/80">Bộ này có thể không chặn được lượt trước.</span>}</div>}
        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</p>}
      </section>}
      <p className="mt-4 text-center text-[11px] tracking-wide text-emerald-100/50">Chơi giải trí, không dùng tiền thật</p>
    </div>
  </main>;
}
