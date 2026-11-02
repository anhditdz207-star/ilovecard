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
        <form className="w-full max-w-sm rounded-2xl bg-emerald-950 p-6 ring-1 ring-emerald-500/40" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { localStorage.setItem("cg_name", name.trim()); setReady(true); } }}>
          <h1 className="mb-1 text-2xl font-bold">Game Bài Online</h1>
          <p className="mb-4 text-xs text-emerald-200/70">Chơi giải trí bằng chip ảo. Vào nhanh với tên khách (đăng nhập Google sẽ có sau).</p>
          <input className="mb-3 w-full rounded bg-emerald-900 px-3 py-2" placeholder="Tên của bạn" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="w-full rounded bg-amber-500 py-2 font-semibold text-black">Vào chơi</button>
        </form>
      </div>
    );
  if (table) return <Table room={table} onLeave={() => setTable(null)} />;
  return <Lobby name={name.trim()} onJoinTable={setTable} />;
}
