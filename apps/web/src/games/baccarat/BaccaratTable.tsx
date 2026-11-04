import { useState } from "react";
import type { RoomInfo, S2C } from "@cg/shared";
import { baccaratRulesText, type BaccaratAction, type BaccaratSide, type BaccaratView } from "@cg/game-baccarat";

const labels: Record<BaccaratSide, string> = { player: "Player", banker: "Banker", tie: "Tie" };
const cardLabel = (card: { rank: number; suit: string }) => `${({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[card.rank] ?? card.rank}${({ S: "♠", C: "♣", D: "♦", H: "♥" } as Record<string, string>)[card.suit]}`;

export function BaccaratTable({ info, data, seat, toAct, result, send }: {
  info: RoomInfo; data: BaccaratView; seat: number; toAct: number[]; result: S2C["result"] | null; send: (t: string, extra?: object) => void;
}) {
  const [side, setSide] = useState<BaccaratSide>("player");
  const [amount, setAmount] = useState(info.baseBet);
  const waiting = toAct.includes(seat);
  const myBet = data.bets[seat];
  return <section className="mt-4 space-y-4 rounded-2xl bg-emerald-950 p-5 ring-1 ring-emerald-500/40">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">Baccarat</h3><p className="text-sm text-emerald-200/70">Chọn cửa cược · mức bàn {info.baseBet.toLocaleString()} chip</p></div><span className="rounded-full bg-black/30 px-3 py-1 text-xs">{data.hand ? `Kết quả: ${labels[data.outcome!]}` : `${data.submitted.length}/${info.seats.filter(Boolean).length} đã chọn`}</span></header>
    <div className="grid gap-3 sm:grid-cols-2">
      {(["player", "banker"] as const).map((name) => <div key={name} className="rounded-xl bg-emerald-900/80 p-4 text-center"><div className="text-sm text-emerald-200">{labels[name]} · {data.hand ? data.hand[name].map(cardLabel).join("  ") : "••  ••"}</div><div className="mt-2 text-2xl font-black">{data.hand ? data.hand[name].reduce((n, c) => n + (c.rank >= 10 ? 0 : c.rank), 0) % 10 : "?"}</div></div>)}
    </div>
    {!data.hand && waiting && <div className="flex flex-wrap items-center gap-2">
      <select className="rounded bg-emerald-800 p-2" value={side} onChange={(e) => setSide(e.target.value as BaccaratSide)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <input className="w-32 rounded bg-emerald-800 p-2" type="number" min={1} max={info.baseBet} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(info.baseBet, Number(e.target.value))))} />
      <button className="rounded bg-amber-400 px-4 py-2 font-bold text-emerald-950" onClick={() => send("action", { a: { type: "bet", side, amount } satisfies BaccaratAction })}>Đặt cược</button>
      <button className="rounded border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10" onClick={() => send("action", { a: { type: "pass" } satisfies BaccaratAction })}>Bỏ lượt</button>
    </div>}
    {!data.hand && !waiting && <p className="text-sm text-emerald-200">{myBet?.type === "pass" ? "Bạn đã bỏ lượt · đang chờ người chơi khác…" : "Đang chờ người chơi đặt cược…"}</p>}
    {data.hand && <div className="rounded-lg bg-black/25 p-3 text-center"><b>{labels[data.outcome!]} thắng</b>{result && <p className="mt-1 text-sm">{result.payouts.map((p) => p.seat === seat ? `Bạn ${p.delta > 0 ? `+${p.delta}` : p.delta} chip` : null).filter(Boolean)}</p>}<p className="mt-1 text-xs text-emerald-200/70">{baccaratRulesText}</p></div>}
  </section>;
}
