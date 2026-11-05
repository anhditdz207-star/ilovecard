import { useEffect, useMemo, useState } from "react";
import type { RoomInfo, S2C } from "@cg/shared";
import { TILES, type BauCuaAction, type BauCuaView, type Bets, type Tile } from "@cg/game-bau-cua";
import { ChipStack } from "../../components/ChipStack";
import { useGameSounds } from "../../hooks/useGameSounds";

const TILE_INFO: Record<Tile, { name: string; icon: string; color: string }> = {
  bau: { name: "Bầu", icon: "🎃", color: "from-orange-400 to-amber-700" },
  cua: { name: "Cua", icon: "🦀", color: "from-rose-400 to-red-700" },
  tom: { name: "Tôm", icon: "🦐", color: "from-pink-400 to-fuchsia-700" },
  ca: { name: "Cá", icon: "🐟", color: "from-cyan-300 to-blue-700" },
  ga: { name: "Gà", icon: "🐓", color: "from-yellow-300 to-orange-700" },
  nai: { name: "Nai", icon: "🦌", color: "from-lime-300 to-green-700" },
};

export function BauCuaTable({ info, data, seat, toAct, result, send }: {
  info: RoomInfo; data: BauCuaView; seat: number; toAct: number[];
  result: S2C["result"] | null; send: (type: string, extra?: object) => void;
}) {
  const [draft, setDraft] = useState<Bets>({});
  const sounds = useGameSounds();
  useEffect(() => { if (data.phase === "over") sounds.win(); }, [data.phase]);
  const mine = info.seats[seat];
  const acting = toAct.includes(seat);
  const isDealer = seat === data.dealer;
  const stagedTotal = useMemo(() => Object.values(draft).reduce((sum, value) => sum + (value ?? 0), 0), [draft]);
  const update = (tile: Tile, amount: number) => setDraft((current) => ({ ...current, [tile]: Math.max(0, Math.floor(amount)) }));
  const placeBets = () => {
    const bets = Object.fromEntries(TILES.filter((tile) => (draft[tile] ?? 0) > 0).map((tile) => [tile, draft[tile]])) as Bets;
    sounds.chip();
    send("action", { a: { type: "bet", bets } satisfies BauCuaAction });
  };
  const roll = () => { sounds.card(); send("action", { a: { type: "roll" } satisfies BauCuaAction }); };
  const diceCounts = TILES.map((tile) => data.dice?.filter((die) => die === tile).length ?? 0);
  const minePayout = result?.payouts.find((p) => p.seat === seat)?.delta;

  return (
    <main className="cg-table p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(#d7ba6b_0.55px,transparent_0.55px)] [background-size:12px_12px]" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-200/70">Bầu Cua · Phòng {info.code}</p><h2 className="text-2xl font-black sm:text-3xl">Bàn hội xuân</h2></div>
          <ChipStack value={info.baseBet} label="Cược bàn" />
        </div>

        <div className="mb-6 flex min-h-24 flex-wrap items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/15 p-4">
          {info.seats.map((player, index) => player && <div key={player.id} className={`min-w-28 rounded-2xl border px-3 py-2 text-center ${index === data.dealer ? "border-amber-200/50 bg-amber-300/10" : "border-white/10 bg-black/15"}`}>
            <div className="text-xs text-emerald-100/60">{index === data.dealer ? "🏦 Nhà cái" : player.isBot ? "🤖 Máy" : "Người chơi"}</div>
            <div className="font-bold">{player.name}{index === seat ? " · Bạn" : ""}</div>
            <ChipStack value={player.chips} label="Chip" compact />
            {data.submitted.includes(index) && <div className="text-[10px] text-emerald-200">Đã đặt cược</div>}
          </div>)}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {TILES.map((tile, index) => {
            const item = TILE_INFO[tile];
            const count = diceCounts[index]!;
            const ownBet = data.bets[seat]?.[tile] ?? 0;
            return <article key={tile} className={`group relative overflow-hidden rounded-3xl border p-4 transition duration-300 sm:p-5 ${count ? "cg-dice-shake scale-[1.02] border-amber-200 bg-amber-200/15 shadow-[0_0_35px_#f6c75e55]" : "border-white/10 bg-black/20 hover:-translate-y-0.5 hover:border-amber-100/40"}`}>
              <div className={`absolute inset-x-4 top-0 h-1 rounded-b-full bg-gradient-to-r ${item.color} opacity-80`} />
              <div className="flex items-center gap-3">
                <div className={`grid size-16 place-items-center rounded-2xl bg-gradient-to-br ${item.color} text-4xl shadow-lg sm:size-20 sm:text-5xl`}>{item.icon}</div>
                <div className="min-w-0 flex-1"><h3 className="text-lg font-extrabold">{item.name}</h3><div className="text-xs text-emerald-100/60">{data.phase === "over" ? `${count} mặt xuất hiện` : "Đặt chip vào cửa này"}</div></div>
                {count > 0 && <span className="animate-bounce rounded-full bg-amber-300 px-2.5 py-1 text-sm font-black text-emerald-950">×{count}</span>}
              </div>
              <div className="mt-3"><ChipStack value={ownBet} label="Cược của bạn" compact /></div>
              {acting && !isDealer && <div className="mt-3 flex items-center gap-2">
                <button aria-label={`Giảm cược ${item.name}`} className="grid size-9 place-items-center rounded-lg bg-white/10 text-lg hover:bg-white/20" onClick={() => update(tile, (draft[tile] ?? 0) - info.baseBet)}>−</button>
                <input aria-label={`Mức cược ${item.name}`} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-center text-sm" type="number" min="0" step={info.baseBet} value={draft[tile] ?? 0} onChange={(e) => update(tile, Number(e.target.value))} />
                <button aria-label={`Tăng cược ${item.name}`} className="grid size-9 place-items-center rounded-lg bg-white/10 text-lg hover:bg-white/20" onClick={() => update(tile, (draft[tile] ?? 0) + info.baseBet)}>+</button>
              </div>}
            </article>;
          })}
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row">
          <div className="text-sm text-emerald-100/80">
            {data.phase === "betting" && <>{acting ? `Chọn cửa cược · tối đa ${(mine?.chips ?? 0).toLocaleString()} chip` : "Đang chờ người chơi đặt cược…"}{acting && <span className="ml-2 text-amber-100">Tổng: {stagedTotal.toLocaleString()}</span>}</>}
            {data.phase === "rolling" && (isDealer && acting ? "Mọi người đã cược. Nhà cái gieo xúc xắc!" : "Nhà cái chuẩn bị gieo xúc xắc…")}
            {data.phase === "over" && <span className="font-bold">Kết quả: {data.dice?.map((die) => TILE_INFO[die].name).join(" · ")}{minePayout !== undefined && <span className={`ml-2 ${minePayout >= 0 ? "text-amber-200" : "text-rose-300"}`}>{minePayout >= 0 ? "+" : ""}{minePayout.toLocaleString()} chip</span>}</span>}
          </div>
          {acting && !isDealer && <button disabled={stagedTotal > (mine?.chips ?? 0)} className="w-full rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3 font-black text-emerald-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" onClick={placeBets}>Xác nhận cược</button>}
          {acting && isDealer && <button className="w-full rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-3 font-black text-emerald-950 shadow-lg transition hover:brightness-110 sm:w-auto" onClick={roll}>🎲 Gieo xúc xắc</button>}
          {data.phase === "over" && <div className="font-bold text-emerald-100">Đang chốt chip…</div>}
        </div>
        <p className="mt-4 text-center text-[11px] tracking-wide text-emerald-100/50">Chơi giải trí, không dùng tiền thật</p>
      </div>
    </main>
  );
}
