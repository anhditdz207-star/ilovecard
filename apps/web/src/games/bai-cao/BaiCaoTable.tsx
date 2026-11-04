import type { Card as GameCard, RoomInfo, S2C } from "@cg/shared";
import { baiCaoPoints, isBaTay, type BaiCaoView } from "@cg/game-bai-cao";
import { Card } from "../../components/Card";
import { ChipStack } from "../../components/ChipStack";
import { useGameSounds } from "../../hooks/useGameSounds";

function handName(cards: GameCard[]) { return isBaTay(cards) ? "Ba Tây" : `${baiCaoPoints(cards)} điểm`; }

export function BaiCaoTable({ info, data, seat, toAct, result, send }: {
  info: RoomInfo; data: BaiCaoView; seat: number; toAct: number[]; result: S2C["result"] | null; send: (t: string, extra?: object) => void;
}) {
  const waiting = toAct.includes(seat);
  const sounds = useGameSounds();
  return <section className="cg-table mt-4 space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">Bài Cào</h3><p className="text-sm text-emerald-200/70">Ba lá · so với nhà cái</p></div><div className="flex items-center gap-3"><ChipStack value={info.baseBet} label="Cược bàn" compact /><span className="rounded-full bg-black/30 px-3 py-1 text-xs">{data.revealed.length}/{info.seats.filter(Boolean).length} đã lật</span></div></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {!data.revealed.includes(seat) && data.hands[seat] && <div className="cg-panel border-amber-200/40 p-4"><div className="mb-3 flex justify-between text-sm"><b>Bài của bạn</b><span>{handName(data.hands[seat]!)}</span></div><div className="flex gap-2">{data.hands[seat]!.map((card, index) => <Card key={`${card.rank}${card.suit}`} card={card} delay={index * 65} />)}</div></div>}
      {data.revealed.map((player) => {
        const cards = data.hands[player] ?? [];
        const name = info.seats[player]?.name ?? `Ghế ${player}`;
        return <div key={player} className={`cg-panel p-4 ${player === data.dealer ? "border-amber-200/40 bg-amber-900/20" : ""}`}>
          <div className="mb-3 flex justify-between text-sm"><b>{name}{player === data.dealer ? " · Nhà cái" : ""}</b><span>{handName(cards)}</span></div>
          <div className="flex gap-2">{cards.map((card, index) => <Card key={`${card.rank}${card.suit}`} card={card} delay={index * 65} />)}</div>
        </div>;
      })}
      {info.seats.map((player, index) => player && index !== seat && !data.revealed.includes(index) && <div key={index} className="cg-panel p-4 text-sm text-emerald-200/70"><div className="mb-3">{player.name}: úp bài</div><div className="flex gap-2">{[0, 1, 2].map((n) => <Card key={n} hidden size="sm" delay={n * 65} />)}</div></div>)}
    </div>
    {waiting ? <button className="cg-button-primary" onClick={() => { sounds.card(); send("action", { a: { type: "reveal" } }); }}>Lật bài của bạn</button> : !data.over && <p className="text-sm text-emerald-200">Đang chờ người chơi lật bài…</p>}
    {data.over && <div className="cg-panel p-3 text-center text-sm">{result ? result.payouts.map((p) => p.seat === seat ? <ChipStack key={p.seat} value={p.delta} label="Kết quả" compact /> : null) : "Đang chốt chip…"}</div>}
  </section>;
}
