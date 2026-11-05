import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { GAME_CATALOG, type GameId } from "@cg/shared";
import { client, guestAuth } from "../net/client";
import { RulesModal } from "../components/RulesModal";
import { SoundSettings } from "../audio/SoundSettings";
import { GameIcon } from "./GameIcon";

export function Lobby({ name, onJoinTable }: { name: string; onJoinTable: (room: Room) => void }) {
  const [msgs, setMsgs] = useState<{ name: string; text: string }[]>([]);
  const [online, setOnline] = useState<{ userId: string; name: string }[]>([]);
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [rules, setRules] = useState<{ id: GameId; name: string } | null>(null);
  const [err, setErr] = useState("");
  const [showSocial, setShowSocial] = useState(true);
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
  const quickPlay = async (gameId: GameId) => {
    const game = GAME_CATALOG.find((item) => item.id === gameId);
    if (!game) return;
    try {
      const room = await client.create("table", { ...guestAuth(name), gameId, baseBet: 1000 });
      for (let i = 0; i < Math.min(3, game.maxPlayers - 1); i++) room.send("m", { t: "addBot" });
      if (game.hasDealer) room.send("m", { t: "setDealer", seat: 0 });
      onJoinTable(room);
    } catch (e: any) { setErr(e.message ?? String(e)); }
  };
  const join = async () => {
    try { onJoinTable(await client.joinById(code.trim().toUpperCase(), guestAuth(name))); }
    catch (e: any) { setErr(e.message ?? String(e)); }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[1fr_320px]">
      <section>
        <div className="cg-lobby-hero mb-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-7">
          <div><p className="mb-1 text-xs font-bold uppercase tracking-[.3em] text-amber-100/70">Bàn bài của bạn</p><h1 className="text-3xl font-black sm:text-4xl">Chào {name} <span className="text-amber-200">♠</span></h1><p className="mt-2 max-w-lg text-sm text-emerald-50/75">Chọn một bàn, gọi bạn bè hoặc đấu nhanh với máy. Chip ảo, vui cùng nhau.</p></div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="grid size-11 place-items-center rounded-full border-2 border-amber-200/70 bg-emerald-700 text-xl font-black">{name.slice(0, 1).toUpperCase()}</div><div><b className="block">{name}</b><span className="text-xs text-emerald-100/60">Người chơi · chip ảo</span></div><SoundSettings /></div>
        </div>
        <p className="mb-3 text-xs text-emerald-200/70">Chơi giải trí bằng chip ảo, không dùng tiền thật.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          <input className="rounded bg-emerald-900 px-3 py-1.5" placeholder="Mã phòng" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="rounded bg-emerald-600 px-3" onClick={join}>Vào phòng</button>
        </div>
        {err && <p className="mb-2 text-sm text-red-300">{err}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {GAME_CATALOG.map((g) => (
            <article key={g.id} className={`cg-game-tile ${g.status !== "ready" ? "is-unavailable" : ""}`}>
              <div className="flex items-start justify-between gap-2"><GameIcon id={g.id} /><span className="rounded-full bg-black/20 px-2 py-1 text-[10px] text-emerald-50/80">{g.minPlayers}–{g.maxPlayers} người{g.hasDealer ? " · có cái" : ""}</span></div>
              <h2 className="mt-2 font-extrabold">{g.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={g.status !== "ready"} className="cg-button-primary min-h-11 rounded-xl px-3 text-sm disabled:bg-slate-700" onClick={() => create(g.id)}>{g.status === "ready" ? "Tạo phòng" : "Sắp có"}</button>
                {g.status === "ready" && <button className="min-h-11 rounded-xl border border-amber-100/20 bg-amber-300/10 px-3 text-sm font-bold text-amber-100 hover:bg-amber-300/20" onClick={() => quickPlay(g.id)}>Chơi với máy</button>}
                <button className="min-h-11 rounded-xl bg-white/10 px-3 text-sm" aria-label={`Hướng dẫn ${g.name}`} onClick={() => setRules({ id: g.id, name: g.name })}>ⓘ Luật</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <button className="cg-social-toggle rounded-xl bg-emerald-800 p-3 text-sm font-bold" onClick={() => setShowSocial(!showSocial)}>{showSocial ? "Ẩn" : "Bạn bè & chat"} · {online.length} trực tuyến</button>
      {showSocial && <aside className="cg-social-panel flex h-[70vh] flex-col rounded-xl bg-emerald-950 p-3 ring-1 ring-emerald-500/30">
        <div className="mb-1 text-sm text-emerald-200/80">Trực tuyến: {online.map((o) => o.name).join(", ")}</div>
        <div className="flex-1 overflow-y-auto text-sm">
          {msgs.map((m, i) => <div key={i}><b>{m.name}:</b> {m.text}</div>)}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text) { lobby.current?.send("chat", { text }); setText(""); } }}>
          <input className="min-w-0 flex-1 rounded bg-emerald-900 px-2 py-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Chat sảnh…" />
          <button className="rounded bg-emerald-600 px-3">Gửi</button>
        </form>
      </aside>}
      {rules && <RulesModal {...rules} onClose={() => setRules(null)} />}
    </div>
  );
}
