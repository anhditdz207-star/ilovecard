import { useState } from "react";
import type { Room } from "colyseus.js";
import { Lobby } from "./lobby/Lobby";
import { Table } from "./room/Table";

export function App() {
  const [name, setName] = useState(localStorage.getItem("cg_name") ?? "");
  const [ready, setReady] = useState(false);
  const [table, setTable] = useState<Room | null>(null);

  if (!ready)
    return (
      <div className="grid h-full place-items-center p-4">
        <form className="cg-name-screen w-full max-w-md rounded-3xl p-6 sm:p-8" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { localStorage.setItem("cg_name", name.trim()); setReady(true); } }}>
          <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-amber-100/50 bg-amber-300/10 text-4xl text-amber-100">♠</div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.3em] text-amber-200/70">Sòng bài bạn bè</p><h1 className="mb-2 text-3xl font-black">Bàn Bài <span className="text-amber-200">Vui</span></h1>
          <p className="mb-5 text-sm text-emerald-100/75">Chia bài, đặt chip và tận hưởng những ván đấu vui cùng bạn bè.</p>
          <input className="mb-3 min-h-12 w-full rounded-xl border border-white/10 bg-emerald-900 px-3 py-2" placeholder="Tên của bạn" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="cg-button-primary min-h-12 w-full">Vào sảnh chơi</button>
          <p className="mt-4 text-center text-xs text-emerald-100/50">Chơi giải trí bằng chip ảo · Không dùng tiền thật</p>
        </form>
      </div>
    );
  if (table) return <Table room={table} onLeave={() => setTable(null)} />;
  return <Lobby name={name.trim()} onJoinTable={setTable} />;
}
