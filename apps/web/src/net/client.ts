import { Client } from "colyseus.js";

const URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
export const client = new Client(URL);

/** Guest identity persisted locally. Replace with Supabase Google login later (send {token}). */
export function guestAuth(name: string) {
  let id = localStorage.getItem("cg_guest_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cg_guest_id", id);
  }
  return { guestName: name, guestId: id };
}
