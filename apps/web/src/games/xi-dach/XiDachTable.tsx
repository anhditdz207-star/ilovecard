import { useEffect, useState } from "react";
import type { Card, RoomInfo, S2C } from "@cg/shared";
import type { HandCat, HandKind, XiDachView } from "@cg/game-xi-dach";

const suits: Record<Card["suit"], string> = { S: "♠", C: "♣", D: "♦", H: "♥" };
const ranks: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const kinds: Record<HandKind, string> = { bang: "Xì bàng", linh: "Ngũ linh", dach: "Xì dách", normal: "điểm", bust: "Quắc" };
const cardText = (card: Card) => `${ranks[card.rank] ?? card.rank}${suits[card.suit]}`;
const handText = (cat: HandCat) => cat.kind === "normal" ? `${cat.points} điểm` : kinds[cat.kind];

export function XiDachTable({ info, data, seat, toAct, result, send, deadline }: {
  info: RoomInfo; data: XiDachView; seat: number; toAct: number[];
  result: S2C["result"] | null; send: (type: string, extra?: object) => void; deadline: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);

  const current = toAct[0];
  const acting = current === seat;
  const ownCards = data.hands[seat] ?? [];
  const order = [...data.order, data.dealer];
  const payouts = new Map(result?.payouts.map((p) => [p.seat, p.delta]));

  return <main className="relative overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[radial-gradient(ellipse_at_center,_#176348_0%,_#0b382b_56%,_#071e17_100%)] p-4 shadow-2xl sm:p-8">
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(#d7ba6b_0.55px,transparent_0.55px)] [background-size:12px_12px]" />
    <div className="relative mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200/70">Xì Dách · Phòng {info.code}</p><h2 className="text-2xl font-black sm:text-3xl">Bàn Xì Dách</h2></div>
        <div className="rounded-full border border-amber-200/20 bg-black/20 px-4 py-2 text-sm text-amber-100">Cược bàn <b className="ml-1 text-white">{info.baseBet.toLocaleString()} chip</b></div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((player) => {
          const cards = data.hands[player];
          const visible = data.phase === "over" || player === seat;
          const playerInfo = info.seats[player];
          const cat = data.cats?.[player];
          const payout = payouts.get(player) ?? 0;
          return <article key={player} className={`rounded-2xl border p-4 ${player === data.dealer ? "border-amber-200/40 bg-amber-300/10" : "border-white/10 bg-black/15"}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-1 text-sm">
              <b>{playerInfo?.name ?? `Ghế ${player}`}{player === seat ? " · Bạn" : ""}</b>
              <span className="text-amber-100/80">{player === data.dealer ? "🏦 Nhà cái" : playerInfo?.isBot ? "🤖 Máy" : "Người chơi"}</span>
            </div>
            <div className="flex min-h-20 items-center gap-2">
              {visible && cards ? cards.map((card, index) => <div key={`${card.rank}${card.suit}`} className={`xidach-card grid h-16 w-12 place-items-center rounded-md bg-white text-xl font-black shadow-lg ${card.suit === "D" || card.suit === "H" ? "text-red-600" : "text-slate-900"}`} style={{ animationDelay: `${index * 70}ms` }}>{cardText(card)}</div>) : Array.from({ length: data.counts[player] ?? 0 }, (_, index) => <div key={index} className="xidach-card grid h-16 w-12 place-items-center rounded-md border border-amber-100/50 bg-gradient-to-br from-emerald-700 to-emerald-950 text-amber-200 shadow-lg" style={{ animationDelay: `${index * 70}ms` }}>✦</div>)}
            </div>
            {data.phase === "over" && cat && <div className="mt-2 flex items-center justify-between text-sm"><b>{handText(cat)}{cat.kind === "normal" && cat.points === 0 ? " (bù)" : ""}</b>{result ? <span className={payout > 0 ? "text-amber-200" : payout < 0 ? "text-rose-300" : "text-emerald-100/60"}>{payout > 0 ? `+${payout}` : payout} chip</span> : <span className="text-emerald-100/50">Đang chốt</span>}</div>}
            {data.phase !== "over" && data.done.includes(player) && <div className="mt-2 text-xs text-emerald-200/70">Đã xong lượt</div>}
          </article>;
        })}
      </div>

      <section className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        {data.phase === "over" ? <div className="text-center"><h3 className="font-bold text-amber-100">Kết quả ván</h3><p className="mt-1 text-sm text-emerald-100/70">{result ? "Chip đã được chốt." : "Đang chốt chip…"}</p></div> : acting ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{seat === data.dealer ? "Lượt nhà cái" : "Lượt của bạn"}</b><p className="text-sm text-emerald-100/75">{data.myKind && data.myKind !== "normal" ? `${kinds[data.myKind]} · ` : ""}{data.myPoints} điểm</p></div>{deadline !== null && <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Còn {Math.max(0, Math.ceil((deadline - now) / 1000))} giây</span>}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={!data.canHit} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => data.canHit && send("action", { a: { type: "hit" } })}>Rút bài</button>
            <button disabled={!data.canStand} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-emerald-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => data.canStand && send("action", { a: { type: "stand" } })}>Dừng</button>
          </div>
          {!data.canStand && <p className="mt-2 text-xs text-amber-100/80">Cần từ {seat === data.dealer ? 15 : 16} điểm mới được dừng.</p>}
        </> : <p className="text-center text-sm text-emerald-100/80">Đang đến lượt {info.seats[current ?? -1]?.name ?? "người chơi"}…</p>}
      </section>
      <p className="mt-4 text-center text-[11px] tracking-wide text-emerald-100/50">Chơi giải trí, không dùng tiền thật</p>
    </div>
  </main>;
}
