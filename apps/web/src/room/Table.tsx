import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import type { RoomInfo, S2C } from "@cg/shared";
import type { BauCuaView } from "@cg/game-bau-cua";
import { RulesModal } from "../components/RulesModal";
import { BauCuaTable } from "../games/bau-cua/BauCuaTable";
import type { BaccaratView } from "@cg/game-baccarat";
import { BaccaratTable } from "../games/baccarat/BaccaratTable";
import type { BaiCaoView } from "@cg/game-bai-cao";
import { BaiCaoTable } from "../games/bai-cao/BaiCaoTable";
import type { BCTView } from "@cg/game-bai-cao-to";
import { BaiCaoToTable } from "../games/bai-cao-to/BaiCaoToTable";
import type { XiDachView } from "@cg/game-xi-dach";
import { XiDachTable } from "../games/xi-dach/XiDachTable";
import type { TLView } from "@cg/game-tien-len";
import { TienLenTable } from "../games/tien-len/TienLenTable";
import { SoundSettings } from "../audio/SoundSettings";
import { vibrate } from "../audio/sound";
import { WinParticles } from "../ui/WinParticles";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { ChipStack } from "../components/ChipStack";

/** Generic table shell (room lobby + debug game view). Per-game UIs plug in under src/games/<id>/ (ChatGPT). */
export function Table({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [mySeat, setMySeat] = useState(-1);
  const [view, setView] = useState<S2C["view"] | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [result, setResult] = useState<S2C["result"] | null>(null);
  const [tableError, setTableError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showRules, setShowRules] = useState(false);
  const [dismissedResult, setDismissedResult] = useState<S2C["result"] | null>(null);
  const wasActing = useRef(false);
  const send = (t: string, extra: object = {}) => { if (t === "action") setTableError(""); room.send("m", { t, ...extra }); };

  useEffect(() => {
    room.onMessage("me", (m: S2C["me"]) => setMySeat(m.seat));
    room.onMessage("room", setInfo);
    room.onMessage("view", setView);
    room.onMessage("result", (r) => setResult(r));
    room.onMessage("notice", (n: S2C["notice"]) => setNotices((x) => [...x.slice(-4), n.text]));
    room.onMessage("error", (e: S2C["error"]) => { setTableError(e.text); setNotices((x) => [...x.slice(-4), "⚠ " + e.text]); });
    room.onMessage("kicked", (k: S2C["kicked"]) => { alert(k.reason); onLeave(); });
    room.onLeave(() => onLeave());
    send("sync");
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, [room]);

  useEffect(() => {
    const acting = !!view?.toAct.includes(view.seat);
    if (acting && !wasActing.current) vibrate("turn");
    wasActing.current = acting;
  }, [view]);
  useEffect(() => { if (result?.payouts.some((p) => p.seat === view?.seat && p.delta > 0)) vibrate("win"); }, [result]);

  if (!info) return <div className="p-6">Đang vào phòng…</div>;
  const isHost = info.hostSeat === mySeat;
  const paused = info.phase === "paused" && info.paused;

  return (
    <div className={`relative mx-auto p-4 ${["bau-cua", "xi-dach", "tien-len-nam", "tien-len-bac", "bai-cao-to"].includes(info.gameId) ? "max-w-6xl" : "max-w-3xl"}`}>
      <WinParticles trigger={result?.payouts.map((p) => `${p.seat}:${p.delta}`).join(",")} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><button className="text-left text-xl font-bold hover:text-amber-100" title="Nhấn để sao chép mã phòng" onClick={() => { void navigator.clipboard?.writeText(info.code); }}>Phòng {info.code} ⧉</button><div className="mt-1 text-xs text-emerald-200/70">{info.gameId} · cược {info.baseBet} · chip của bạn: {(info.seats[mySeat]?.chips ?? 0).toLocaleString()}</div></div>
        <div className="flex flex-wrap gap-2">
          <SoundSettings />
          <button className="rounded bg-emerald-800 px-3 py-1 text-sm" onClick={() => setShowRules(true)}>Hướng dẫn</button>
          <button className="rounded bg-red-700 px-3 py-1 text-sm" onClick={() => { room.leave(); onLeave(); }}>Thoát</button>
        </div>
      </div>
      <p className="mb-2 text-xs text-emerald-200/70">Gửi mã <b>{info.code}</b> cho bạn bè để vào phòng.</p>
      {paused && <div className="mb-3 rounded bg-amber-600/30 p-2">⏸ Tạm dừng: chờ người chơi quay lại ({Math.max(0, Math.ceil((info.paused!.until - now) / 1000))}s)</div>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {info.seats.map((s, i) => (
          <div key={i} className="rounded-xl bg-emerald-900/80 p-2 ring-1 ring-emerald-500/30">
            {s ? (
              <>
                <Avatar name={s.name} chips={s.chips} active={!!view?.toAct.includes(i)} dealer={i === info.dealerSeat} host={i === info.hostSeat} bot={s.isBot} seconds={view?.deadline ? Math.max(0, Math.ceil((view.deadline - now) / 1000)) : null} />
                {!s.connected && !s.isBot && <div className="mt-1 text-xs text-rose-200">Mất kết nối</div>}
                {info.phase === "lobby" && (
                  <div className="mt-1 flex gap-1 text-xs">
                    {info.hasDealer && <button className="rounded bg-emerald-700 px-2" onClick={() => send("setDealer", { seat: i })}>Làm cái</button>}
                    {s.isBot && <button className="rounded bg-slate-700 px-2" onClick={() => send("removeBot", { seat: i })}>Xoá</button>}
                  </div>
                )}
              </>
            ) : <div className="text-sm text-emerald-300/40">Ghế trống</div>}
          </div>
        ))}
      </div>
      {info.phase === "lobby" && isHost && (
        <div className="mt-3 flex gap-2">
          <button className="rounded bg-emerald-700 px-3 py-1.5" onClick={() => send("addBot")}>+ Thêm máy</button>
          <button className="rounded bg-amber-500 px-4 py-1.5 font-semibold text-black" onClick={() => send("start")}>Bắt đầu</button>
        </div>
      )}
      {info.gameId === "bau-cua" && info.phase !== "lobby" && view ? (
        <div className="mt-4">
          <BauCuaTable info={info} data={view.view as BauCuaView} seat={view.seat} toAct={view.toAct} result={result} send={send} />
        </div>
      ) : info.gameId === "baccarat" && info.phase !== "lobby" && view ? (
        <BaccaratTable info={info} data={view.view as BaccaratView} seat={view.seat} toAct={view.toAct} result={result} send={send} />
      ) : info.gameId === "bai-cao" && info.phase !== "lobby" && view ? (
        <BaiCaoTable info={info} data={view.view as BaiCaoView} seat={view.seat} toAct={view.toAct} result={result} send={send} />
      ) : info.gameId === "bai-cao-to" && info.phase !== "lobby" && view ? (
        <BaiCaoToTable info={info} data={view.view as BCTView} seat={view.seat} toAct={view.toAct} result={result} deadline={view.deadline} error={tableError} send={send} />
      ) : info.gameId === "xi-dach" && info.phase !== "lobby" && view ? (
        <XiDachTable info={info} data={view.view as XiDachView} seat={view.seat} toAct={view.toAct} result={result} deadline={view.deadline} send={send} />
      ) : (info.gameId === "tien-len-nam" || info.gameId === "tien-len-bac") && info.phase !== "lobby" && view ? (
        <TienLenTable info={info} data={view.view as TLView} seat={view.seat} toAct={view.toAct} result={result} deadline={view.deadline} error={tableError} send={send} />
      ) : info.phase !== "lobby" && view && (
        <div className="mt-4 rounded-lg bg-black/30 p-3">
          <pre className="overflow-x-auto text-xs">{JSON.stringify(view.view, null, 1)}</pre>
          {view.toAct.includes(view.seat) && (
            <button className="mt-2 rounded bg-amber-500 px-4 py-1.5 font-semibold text-black" onClick={() => send("action", { a: { type: "draw" } })}>
              Rút bài {view.deadline ? `(${Math.max(0, Math.ceil((view.deadline - now) / 1000))}s)` : ""}
            </button>
          )}
        </div>
      )}
      {result && info.phase === "lobby" && dismissedResult !== result && <Modal title="Kết quả ván" onClose={() => setDismissedResult(result)}><div className="space-y-2">{result.payouts.map((p) => <div key={p.seat} className="flex items-center justify-between rounded-lg bg-black/20 p-2"><span>{info.seats[p.seat]?.name ?? `Ghế ${p.seat}`}</span><span className={p.delta > 0 ? "text-amber-200" : p.delta < 0 ? "text-rose-200" : "text-emerald-100/70"}>{p.delta > 0 ? "+" : ""}{p.delta.toLocaleString()} chip</span></div>)}<div className="flex items-center justify-between border-t border-white/10 pt-3"><span>Chip hiện tại</span><ChipStack value={info.seats[mySeat]?.chips ?? 0} compact /></div>{isHost && <button className="cg-button-primary mt-3 w-full" onClick={() => { setDismissedResult(result); send("start"); }}>Ván mới</button>}</div></Modal>}
      <div className="mt-3 text-xs text-emerald-200/70">{notices.map((n, i) => <div key={i}>{n}</div>)}</div>
      {showRules && <RulesModal id={info.gameId} name={info.gameId} onClose={() => setShowRules(false)} />}
    </div>
  );
}
