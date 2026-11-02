import { Room, type Client } from "@colyseus/core";
import type { L_C2S } from "@cg/shared";
import { authenticate, type AuthUser } from "../auth";

interface Msg { name: string; text: string; ts: number }

/** Global lobby: chat + online list + invites. Single shared room (joinOrCreate 'lobby'). */
export class LobbyRoom extends Room {
  maxClients = 500;
  private history: Msg[] = [];
  private users = new Map<string, AuthUser>(); // sessionId -> user
  private lastChat = new Map<string, number>();

  async onAuth(_c: Client, options: any) {
    return authenticate(options);
  }

  onCreate() {
    this.onMessage("*", (client, type, msg: any) => {
      const u = this.users.get(client.sessionId);
      if (!u) return;
      const m = { t: type, ...(msg ?? {}) } as L_C2S;
      if (m.t === "chat") {
        const text = String((m as any).text ?? "").trim().slice(0, 200);
        const now = Date.now();
        if (!text || now - (this.lastChat.get(client.sessionId) ?? 0) < 500) return;
        this.lastChat.set(client.sessionId, now);
        const entry = { name: u.name, text, ts: now };
        this.history.push(entry);
        if (this.history.length > 50) this.history.shift();
        this.broadcast("chat", entry);
      } else if (m.t === "invite") {
        const target = [...this.clients].find((c) => this.users.get(c.sessionId)?.userId === (m as any).userId);
        target?.send("invited", { from: u.name, roomCode: String((m as any).roomCode ?? "").slice(0, 12) });
      }
    });
  }

  onJoin(client: Client, _o: any, auth: AuthUser) {
    this.users.set(client.sessionId, auth);
    client.send("history", this.history);
    this.pushOnline();
  }

  onLeave(client: Client) {
    this.users.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
    this.pushOnline();
  }

  private pushOnline() {
    this.broadcast("online", [...this.users.values()].map((u) => ({ userId: u.userId, name: u.name })));
  }
}
