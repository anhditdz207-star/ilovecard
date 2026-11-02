import type { Card, RoomInfo, S2C } from "@cg/shared";
import { baiCaoPoints, isBaTay, type BaiCaoView } from "@cg/game-bai-cao";

const suits: Record<string, string> = { S: "♠", C: "♣", D: "♦", H: "♥" };
const rank: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const label = (card: Card) => `${rank[card.rank] ?? card.rank}${suits[card.suit]}`;
function handName(cards: Card[]) { return isBaTay(cards) ? "Ba Tây" : `${baiCaoPoints(cards)} điểm`; }

export function BaiCaoTable({ info, data, seat, toAct, result, send }: {
  info: RoomInfo; data: BaiCaoView; seat: number; toAct: number[]; result: S2C["result"] | null; send: (t: string, extra?: object) => void;
}) {
  const waiting = toAct.includes(seat);
  return <section className="mt-4 space-y-4 rounded-2xl bg-emerald-950 p-5 ring-1 ring-emerald-500/40">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">Bài Cào</h3><p className="text-sm text-emerald-200/70">Ba lá · cược {info.baseBet.toLocaleString()} chip</p></div><span className="rounded-full bg-black/30 px-3 py-1 text-xs">{data.revealed.length}/{info.seats.filter(Boolean).length} đã lật</span></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {!data.revealed.includes(seat) && data.hands[seat] && <div className="rounded-xl bg-emerald-900/80 p-4 ring-1 ring-amber-400/40"><div className="mb-3 flex justify-between text-sm"><b>Bài của bạn</b><span>{handName(data.hands[seat]!)}</span></div><div className="flex gap-2">{data.hands[seat]!.map((card, i) => <div key={i} className={`grid h-16 w-12 place-items-center rounded-md bg-white text-xl font-bold shadow ${card.suit === "D" || card.suit === "H" ? "text-red-600" : "text-slate-900"}`}>{label(card)}</div>)}</div></div>}
      {data.revealed.map((player) => {
        const cards = data.hands[player] ?? [];
        const name = info.seats[player]?.name ?? `Ghế ${player}`;
        return <div key={player} className={`rounded-xl p-4 ${player === data.dealer ? "bg-amber-900/40 ring-1 ring-amber-400/40" : "bg-emerald-900/80"}`}>
          <div className="mb-3 flex justify-between text-sm"><b>{name}{player === data.dealer ? " · Nhà cái" : ""}</b><span>{handName(cards)}</span></div>
          <div className="flex gap-2">{cards.map((card, i) => <div key={i} className={`grid h-16 w-12 place-items-center rounded-md bg-white text-xl font-bold shadow ${card.suit === "D" || card.suit === "H" ? "text-red-600" : "text-slate-900"}`}>{label(card)}</div>)}</div>
        </div>;
      })}
      {info.seats.map((player, index) => player && index !== seat && !data.revealed.includes(index) && <div key={index} className="rounded-xl bg-emerald-900/40 p-4 text-sm text-emerald-200/70">{player.name}: úp bài</div>)}
    </div>
    {waiting ? <button className="rounded bg-amber-400 px-4 py-2 font-bold text-emerald-950" onClick={() => send("action", { a: { type: "reveal" } })}>Lật bài của bạn</button> : !data.over && <p className="text-sm text-emerald-200">Đang chờ người chơi lật bài…</p>}
    {data.over && result && <p className="rounded-lg bg-black/25 p-3 text-center text-sm">{result.payouts.map((p) => p.seat === seat ? `Kết quả: ${p.delta > 0 ? `+${p.delta}` : p.delta} chip` : null).filter(Boolean)}</p>}
  </section>;
}
