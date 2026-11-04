import { useEffect, useState } from "react";
import type { RoomInfo, S2C } from "@cg/shared";
import type { HandCat, HandKind, XiDachView } from "@cg/game-xi-dach";
import { Card } from "../../components/Card";
import { ChipStack } from "../../components/ChipStack";
import { useGameSounds } from "../../hooks/useGameSounds";

const kinds: Record<HandKind, string> = { bang: "Xì bàng", linh: "Ngũ linh", dach: "Xì dách", normal: "điểm", bust: "Quắc" };
const handText = (cat: HandCat) => cat.kind === "normal" ? `${cat.points} điểm` : kinds[cat.kind];

export function XiDachTable({ info, data, seat, toAct, result, send, deadline }: {
  info: RoomInfo; data: XiDachView; seat: number; toAct: number[];
  result: S2C["result"] | null; send: (type: string, extra?: object) => void; deadline: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  const sounds = useGameSounds();
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => { if (data.phase === "over") sounds.win(); }, [data.phase]);

  const current = toAct[0];
  const acting = current === seat;
  const order = [...data.order, data.dealer];
  const payouts = new Map(result?.payouts.map((p) => [p.seat, p.delta]));
  return <main className="cg-table p-4 sm:p-8">
    <div className="relative mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200/70">Xì Dách · Phòng {info.code}</p><h2 className="text-2xl font-black sm:text-3xl">Bàn Xì Dách</h2></div>
        <ChipStack value={info.baseBet} label="Cược bàn" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((player) => {
          const cards = data.hands[player];
          const visible = data.phase === "over" || player === seat;
          const playerInfo = info.seats[player];
          const cat = data.cats?.[player];
          const payout = payouts.get(player) ?? 0;
          return <article key={player} className={`cg-panel p-4 ${player === data.dealer ? "border-amber-200/40 bg-amber-300/10" : ""}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-1 text-sm"><b>{playerInfo?.name ?? `Ghế ${player}`}{player === seat ? " · Bạn" : ""}</b><span className="text-amber-100/80">{player === data.dealer ? "🏦 Nhà cái" : playerInfo?.isBot ? "🤖 Máy" : "Người chơi"}</span></div>
            <ChipStack value={playerInfo?.chips ?? 0} label="Chip" compact />
            <div className="mt-3 flex min-h-24 items-center gap-2">
              {visible && cards ? cards.map((card, index) => <Card key={`${card.rank}${card.suit}`} card={card} size="md" delay={index * 70} />) : Array.from({ length: data.counts[player] ?? 0 }, (_, index) => <Card key={`${player}-${index}`} hidden size="md" delay={index * 70} />)}
            </div>
            {data.phase === "over" && cat && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"><b>{handText(cat)}{cat.kind === "normal" && cat.points === 0 ? " (bù)" : ""}</b>{result ? <ChipStack value={payout} label="Kết quả" compact /> : <span className="text-emerald-100/50">Đang chốt</span>}</div>}
            {data.phase !== "over" && data.done.includes(player) && <div className="mt-2 text-xs text-emerald-200/70">Đã xong lượt</div>}
          </article>;
        })}
      </div>

      <section className="cg-panel mt-5 p-4">
        {data.phase === "over" ? <div className={`text-center ${result?.payouts.some((p) => p.seat === seat && p.delta > 0) ? "cg-win" : ""}`}><h3 className="font-bold text-amber-100">Kết quả ván</h3><p className="mt-1 text-sm text-emerald-100/70">{result ? "Chip đã được chốt." : "Đang chốt chip…"}</p></div> : acting ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{seat === data.dealer ? "Lượt nhà cái" : "Lượt của bạn"}</b><p className="text-sm text-emerald-100/75">{data.myKind && data.myKind !== "normal" ? `${kinds[data.myKind]} · ` : ""}{data.myPoints} điểm</p></div>{deadline !== null && <span className="rounded-full bg-white/10 px-3 py-1 text-sm">Còn {Math.max(0, Math.ceil((deadline - now) / 1000))} giây</span>}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={!data.canHit} className="cg-button-primary bg-emerald-700 text-white" onClick={() => { if (data.canHit) { sounds.card(); send("action", { a: { type: "hit" } }); } }}>Rút bài</button>
            <button disabled={!data.canStand} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-emerald-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { if (data.canStand) { sounds.pass(); send("action", { a: { type: "stand" } }); } }}>Dừng</button>
          </div>
          {!data.canStand && <p className="mt-2 text-xs text-amber-100/80">Cần từ {seat === data.dealer ? 15 : 16} điểm mới được dừng.</p>}
        </> : <p className="text-center text-sm text-emerald-100/80">Đang đến lượt {info.seats[current ?? -1]?.name ?? "người chơi"}…</p>}
      </section>
      <p className="mt-4 text-center text-[11px] tracking-wide text-emerald-100/50">Chơi giải trí, không dùng tiền thật</p>
    </div>
  </main>;
}
