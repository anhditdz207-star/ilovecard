export type GameId =
  | "demo"
  | "bau-cua"
  | "xi-dach"
  | "tien-len-nam"
  | "tien-len-bac"
  | "bai-cao"
  | "bai-cao-to"
  | "baccarat"
  | "poker";

export interface GameMeta {
  id: GameId;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  hasDealer: boolean;
  /** 'ready' = engine registered on server; 'planned' = shown greyed out in lobby */
  status: "ready" | "planned";
}

export const GAME_CATALOG: GameMeta[] = [
  { id: "bau-cua", name: "Bầu Cua", minPlayers: 1, maxPlayers: 12, hasDealer: true, status: "planned" },
  { id: "xi-dach", name: "Xì Dách", minPlayers: 2, maxPlayers: 8, hasDealer: true, status: "planned" },
  { id: "tien-len-nam", name: "Tiến Lên Miền Nam", minPlayers: 2, maxPlayers: 4, hasDealer: false, status: "planned" },
  { id: "tien-len-bac", name: "Tiến Lên Miền Bắc", minPlayers: 2, maxPlayers: 4, hasDealer: false, status: "planned" },
  { id: "bai-cao", name: "Bài Cào (Bài Điểm)", minPlayers: 2, maxPlayers: 12, hasDealer: true, status: "planned" },
  { id: "bai-cao-to", name: "Bài Cào Tố", minPlayers: 2, maxPlayers: 8, hasDealer: false, status: "planned" },
  { id: "baccarat", name: "Baccarat", minPlayers: 1, maxPlayers: 12, hasDealer: false, status: "planned" },
  { id: "poker", name: "Poker (Texas Hold'em)", minPlayers: 2, maxPlayers: 9, hasDealer: false, status: "planned" },
  { id: "demo", name: "Demo (Rút bài lớn nhất)", minPlayers: 2, maxPlayers: 6, hasDealer: true, status: "ready" },
];

export const DEFAULT_CHIPS = 100_000;
export const RECONNECT_SECONDS = 15;
export const TURN_SECONDS = 30;

export interface SeatInfo {
  seat: number;
  /** stable user id: 'guest:xxxx' or supabase uid; bots: 'bot:n' */
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
}

/** Seat as shown to everyone in a room. */
export interface PublicSeat extends SeatInfo {
  connected: boolean;
  /** bot is playing on behalf of a human who left; kicked after the hand */
  botControlled: boolean;
  ready: boolean;
}

export type RoomPhase = "lobby" | "playing" | "paused";

export interface RoomInfo {
  code: string;
  gameId: GameId;
  phase: RoomPhase;
  hostSeat: number;
  dealerSeat: number | null;
  baseBet: number;
  maxPlayers: number;
  minPlayers: number;
  hasDealer: boolean;
  seats: (PublicSeat | null)[];
  /** when phase==='paused': seats being waited for + epoch ms deadline */
  paused?: { seats: number[]; until: number };
  flags: Record<string, boolean | number>;
}
