import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { GAME_CATALOG, type GameId } from "@cg/shared";
import { client, guestAuth } from "../net/client";
import { RulesModal } from "../components/RulesModal";
import { SoundSettings } from "../audio/SoundSettings";

export function Lobby({ name, onJoinTable }: { name: string; onJoinTable: (room: Room) => void }) {
  const [msgs, setMsgs] = useState<{ name: string; text: string }[]>([]);
  const [online, setOnline] = useState<{ userId: string; name: string }[]>([]);
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [rules, setRules] = useState<{ id: GameId; name: string } | null>(null);
  const [err, setErr] = useState("");
  const lobby = useRef<Room | null>(null);

  useEffect(() => {
    let alive = true;
    let r: Room | null = null;
    client.joinOrCreate("lobby", guestAuth(name)).then((room) => {
      if (!alive) return void room.leave();
      r = lobby.current = room;
      room.onMessage("history", (h) => setMsgs(h));
      room.onMessage("chat", (m) => setMsgs((x) => [...x.slice(-99), m]));
      room.onMessage("online", setOnline);
    }).catch((e) => setErr(String(e.message ?? e)));
    return () => { alive = false; r?.leave(); };
  }, [name]);

  const create = async (gameId: GameId) => {
    try { onJoinTable(await client.create("table", { ...guestAuth(name), gameId, baseBet: 1000 })); }
    catch (e: any) { setErr(e.message ?? String(e)); }
  };
  const join = async () => {
    try { onJoinTable(await client.joinById(code.trim().toUpperCase(), guestAuth(name))); }
    catch (e: any) { setErr(e.message ?? String(e)); }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Sảnh game · xin chào {name}</h1><SoundSettings /></div>
        <p className="mb-3 text-xs text-emerald-200/70">Chơi giải trí bằng chip ảo, không dùng tiền thật.</p>
        <div className="mb-4 flex gap-2">
          <input className="rounded bg-emerald-900 px-3 py-1.5" placeholder="Mã phòng" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="rounded bg-emerald-600 px-3" onClick={join}>Vào phòng</button>
        </div>
        {err && <p className="mb-2 text-sm text-red-300">{err}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {GAME_CATALOG.map((g) => (
            <div key={g.id} className={`rounded-xl p-4 ring-1 ring-emerald-500/30 ${g.status === "ready" ? "bg-emerald-900" : "bg-emerald-950/60 opacity-60"}`}>
              <div className="font-semibold">{g.name}</div>
              <div className="text-xs text-emerald-200/70">{g.minPlayers}-{g.maxPlayers} người{g.hasDealer ? " · có cái" : ""}</div>
              <div className="mt-3 flex gap-2">
                <button disabled={g.status !== "ready"} className="rounded bg-emerald-600 px-3 py-1 text-sm disabled:bg-slate-700" onClick={() => create(g.id)}>
                  {g.status === "ready" ? "Tạo phòng" : "Sắp có"}
                </button>
                <button className="rounded bg-emerald-800 px-3 py-1 text-sm" onClick={() => setRules({ id: g.id, name: g.name })}>Hướng dẫn</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="flex h-[70vh] flex-col rounded-xl bg-emerald-950 p-3 ring-1 ring-emerald-500/30">
        <div className="mb-1 text-sm text-emerald-200/80">Trực tuyến: {online.map((o) => o.name).join(", ")}</div>
        <div className="flex-1 overflow-y-auto text-sm">
          {msgs.map((m, i) => <div key={i}><b>{m.name}:</b> {m.text}</div>)}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text) { lobby.current?.send("chat", { text }); setText(""); } }}>
          <input className="min-w-0 flex-1 rounded bg-emerald-900 px-2 py-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Chat sảnh…" />
          <button className="rounded bg-emerald-600 px-3">Gửi</button>
        </form>
      </aside>
      {rules && <RulesModal {...rules} onClose={() => setRules(null)} />}
    </div>
  );
}
