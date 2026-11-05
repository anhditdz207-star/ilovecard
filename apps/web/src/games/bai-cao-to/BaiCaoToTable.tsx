import { useEffect, useState } from "react";
import type { RoomInfo, S2C } from "@cg/shared";
import type { BCTView } from "@cg/game-bai-cao-to";
import { Card } from "../../components/Card";
import { ChipStack } from "../../components/ChipStack";
import { useGameSounds } from "../../hooks/useGameSounds";

export function BaiCaoToTable({ info, data, seat, toAct, result, deadline, error, send }: {
  info: RoomInfo; data: BCTView; seat: number; toAct: number[]; result: S2C["result"] | null;
  deadline: number | null; error: string; send: (type: string, extra?: object) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [raiseTo, setRaiseTo] = useState(data.minRaiseTo);
  const sounds = useGameSounds();
  const acting = toAct.includes(seat);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => setRaiseTo(data.minRaiseTo), [data.minRaiseTo, data.currentBet]);
  const act = (type: string, extra: object = {}) => { sounds.chip(); send("action", { a: { type, ...extra } }); };
  const payouts = new Map(result?.payouts.map((p) => [p.seat, p.delta]));

  return <main className="cg-table mt-4 p-4 sm:p-7">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[.25em] text-amber-200/70">Bài Cào Tố · Phòng {info.code}</p><h2 className="text-2xl font-black">Bàn Bài Cào Tố</h2></div>
        <ChipStack value={data.pot} label="Hũ" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.order.map((player) => {
          const folded = data.folded.includes(player);
          const winner = data.winners?.includes(player) ?? false;
          const hand = player === seat ? data.myHand : data.hands?.[player];
          const label = player === seat ? data.myInfo.label : data.infos?.[player]?.label;
          return <article key={player} className={`cg-panel p-3 ${folded ? "opacity-40" : ""} ${player === data.current && !data.over ? "border-amber-200/60 ring-1 ring-amber-200/30" : ""} ${winner ? "cg-win border-amber-200/60" : ""}`}>
            <div className="flex items-center justify-between gap-2"><b className="truncate">{info.seats[player]?.name ?? `Ghế ${player}`}{player === seat ? " · Bạn" : ""}</b>{folded ? <span className="text-xs text-rose-200">Úp bài</span> : winner ? <span className="text-xs text-amber-100">Thắng</span> : null}</div>
            <div className="mt-2 flex min-h-20 items-center justify-center gap-1.5">
              {player === seat || data.showdown ? (hand ?? []).map((card, index) => <Card key={`${card.rank}${card.suit}`} card={card} size="sm" delay={index * 70} />) : Array.from({ length: 3 }, (_, i) => <Card key={i} hidden size="sm" delay={i * 70} />)}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs"><span>{label ?? (folded ? "Đã úp bài" : "Đang tố")}</span><ChipStack value={data.committed[player] ?? 0} label="Đã góp" compact /></div>
            {result && <div className={`mt-1 text-right text-sm font-bold ${(payouts.get(player) ?? 0) > 0 ? "text-amber-200" : "text-emerald-100/60"}`}>{(payouts.get(player) ?? 0) > 0 ? "+" : ""}{(payouts.get(player) ?? 0).toLocaleString()} chip</div>}
          </article>;
        })}
      </div>

      <section className="cg-panel p-4">
        {data.over ? <div className="text-center"><h3 className="text-lg font-black text-amber-100">{data.showdown ? "Lật bài · Kết quả" : "Người chơi cuối cùng thắng"}</h3>{result ? <p className="mt-1 text-sm text-emerald-100/80">Chip đã được chốt.</p> : <p className="mt-1 text-sm text-emerald-100/60">Đang chốt chip…</p>}</div> : acting ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><b>Lượt của bạn</b><span className="text-sm text-emerald-100/75">{data.toCall > 0 ? `Theo ${data.toCall.toLocaleString()}` : "Chưa có tiền cần theo"} · Còn {data.raisesLeft} lần tố</span>{deadline !== null && <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{Math.max(0, Math.ceil((deadline - now) / 1000))} giây</span>}</div>
          {data.canRaise && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"><input aria-label="Mức tố" type="range" min={data.minRaiseTo} max={data.maxRaiseTo} step={1} value={Math.min(raiseTo, data.maxRaiseTo)} onChange={(e) => setRaiseTo(Number(e.target.value))} /><div className="flex gap-2"><button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setRaiseTo(data.minRaiseTo)}>Min</button><button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setRaiseTo(Math.round((data.minRaiseTo + data.maxRaiseTo) / 2))}>½</button><button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setRaiseTo(data.maxRaiseTo)}>Max</button></div><div className="text-sm text-amber-100 sm:col-span-2">Tố lên {raiseTo.toLocaleString()}</div></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.canCheck && <button className="cg-button-primary" onClick={() => act("check")}>Qua</button>}
            {data.canCall && <button className="cg-button-primary" onClick={() => act("call")}>Theo {data.toCall.toLocaleString()}</button>}
            {data.canRaise && <button className="cg-button-primary" onClick={() => act("raise", { to: raiseTo })}>Tố lên {raiseTo.toLocaleString()}</button>}
            <button className="rounded-xl border border-rose-200/30 px-5 py-3 font-bold text-rose-100 hover:bg-rose-400/10" onClick={() => act("fold")}>Úp bài</button>
          </div>
        </> : <p className="text-center text-sm text-emerald-100/80">Đang chờ {info.seats[data.current]?.name ?? "người chơi"} hành động…</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-950/70 p-2 text-sm text-rose-100">{error}</p>}
      </section>
      <p className="text-center text-[11px] text-emerald-100/50">Chip ảo · Chơi giải trí, không dùng tiền thật</p>
    </div>
  </main>;
}
