import { useEffect, useRef, useState } from "react";
import type { RoomInfo, S2C } from "@cg/shared";
import { baccaratRulesText, type BaccaratAction, type BaccaratSide, type BaccaratView } from "@cg/game-baccarat";
import { Card } from "../../components/Card";
import { ChipStack } from "../../components/ChipStack";
import { useGameSounds } from "../../hooks/useGameSounds";

const labels: Record<BaccaratSide, string> = { player: "Player", banker: "Banker", tie: "Tie" };
const score = (cards: { rank: number }[]) => cards.reduce((n, card) => n + (card.rank >= 10 ? 0 : card.rank), 0) % 10;

export function BaccaratTable({ info, data, seat, toAct, result, send }: {
  info: RoomInfo; data: BaccaratView; seat: number; toAct: number[]; result: S2C["result"] | null; send: (t: string, extra?: object) => void;
}) {
  const [side, setSide] = useState<BaccaratSide>("player");
  const [amount, setAmount] = useState(info.baseBet);
  const sounds = useGameSounds();
  const hadHand = useRef(false);
  useEffect(() => { if (data.hand && !hadHand.current) sounds.win(); hadHand.current = !!data.hand; }, [data.hand]);
  const waiting = toAct.includes(seat);
  const myBet = data.bets[seat];
  return <section className="cg-table mt-4 space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-xl font-bold">Baccarat</h3><p className="text-sm text-emerald-200/70">Player · Banker · Tie</p></div><span className="rounded-full bg-black/30 px-3 py-1 text-xs">{data.hand ? `Kết quả: ${labels[data.outcome!]}` : `${data.submitted.length}/${info.seats.filter(Boolean).length} đã chọn`}</span></header>
    <div className="grid gap-3 sm:grid-cols-2">
      {(["player", "banker"] as const).map((name) => {
        const cards = data.hand?.[name] ?? [];
        return <div key={name} className="cg-panel p-4 text-center"><div className="mb-3 text-sm font-bold text-emerald-100">{labels[name]}</div><div className="flex min-h-24 flex-wrap justify-center gap-2">{(data.hand ? cards : [null, null]).map((card, index) => <Card key={card ? `${card.rank}${card.suit}` : `${name}-${index}`} card={card} hidden={!data.hand} size="md" delay={index * 80} />)}</div><div className="mt-2 text-2xl font-black">{data.hand ? score(cards) : "?"}</div></div>;
      })}
    </div>
    {!data.hand && waiting && <div className="cg-panel flex flex-wrap items-center gap-2 p-3">
      <select className="rounded-lg border border-white/10 bg-emerald-950 p-2" value={side} onChange={(e) => setSide(e.target.value as BaccaratSide)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <input aria-label="Mức cược" className="w-28 rounded-lg border border-white/10 bg-emerald-950 p-2" type="number" min={1} max={info.baseBet} value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(info.baseBet, Number(e.target.value))))} />
      <ChipStack value={amount} label="Cược" compact />
      <button className="cg-button-primary" onClick={() => { sounds.chip(); send("action", { a: { type: "bet", side, amount } satisfies BaccaratAction }); }}>Đặt cược</button>
      <button className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10" onClick={() => { sounds.pass(); send("action", { a: { type: "pass" } satisfies BaccaratAction }); }}>Bỏ lượt</button>
    </div>}
    {!data.hand && !waiting && <p className="text-sm text-emerald-200">{myBet?.type === "pass" ? "Bạn đã bỏ lượt · đang chờ người chơi khác…" : "Đang chờ người chơi đặt cược…"}</p>}
    {data.hand && <div className={`cg-panel p-3 text-center ${result?.payouts.some((p) => p.seat === seat && p.delta > 0) ? "cg-win" : ""}`}><b>{labels[data.outcome!]} thắng</b>{result && <p className="mt-1 text-sm">{result.payouts.map((p) => p.seat === seat ? `Bạn ${p.delta > 0 ? `+${p.delta}` : p.delta} chip` : null).filter(Boolean)}</p>}<p className="mt-2 text-xs text-emerald-200/70">{baccaratRulesText}</p></div>}
  </section>;
}
