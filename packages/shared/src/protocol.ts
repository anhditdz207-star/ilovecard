import type { RoomInfo, SeatInfo } from "./types";

/** Client -> TableRoom. Sent as room.send("m", payload). */
export type C2S =
  | { t: "sync" } // call after registering handlers: server replies with room + view
  | { t: "addBot" }
  | { t: "removeBot"; seat: number }
  | { t: "setDealer"; seat: number }
  | { t: "setBet"; baseBet: number }
  | { t: "setFlag"; key: string; value: boolean | number }
  | { t: "start" }
  | { t: "action"; a: unknown }
  | { t: "chat"; text: string }
  | { t: "kick"; seat: number };

/** TableRoom -> Client (message name = t) */
export interface S2C {
  me: { seat: number }; // your seat index
  room: RoomInfo; // any change of public room info
  view: { seat: number; view: unknown; toAct: number[]; deadline: number | null }; // per-seat private view; deadline = epoch ms of turn timeout
  result: { payouts: { seat: number; delta: number }[]; seats: SeatInfo[] };
  notice: { code: NoticeCode; text: string; seat?: number };
  chat: { seat: number; name: string; text: string };
  kicked: { reason: string };
  error: { text: string };
}

export type NoticeCode =
  | "paused"
  | "resumed"
  | "player_left_bot"
  | "player_broke_kicked"
  | "dealer_broke_closed"
  | "dealer_changed"
  | "info";

/** Client -> LobbyRoom. Sent as lobby.send(t, rest) (message type = t). */
export type L_C2S =
  | { t: "chat"; text: string }
  | { t: "invite"; userId: string; roomCode: string };

/** LobbyRoom -> Client */
export interface L_S2C {
  chat: { name: string; text: string; ts: number };
  history: { name: string; text: string; ts: number }[];
  online: { userId: string; name: string }[];
  invited: { from: string; roomCode: string };
}
