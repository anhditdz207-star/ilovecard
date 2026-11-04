import { Room, type Client } from "@colyseus/core";
import {
  RECONNECT_SECONDS, TURN_SECONDS, secureRng,
  type C2S, type GameEngine, type GameId, type NoticeCode, type PublicSeat, type RoomInfo, type RoomPhase, type SeatInfo,
} from "@cg/shared";
import { authenticate, type AuthUser } from "../auth";
import { engines } from "../registry";
import { store } from "../store";
import { roomCode } from "../util";

const FAST = process.env.CG_FAST === "1"; // tests: shorten timers
const T = {
  reconnectMs: (FAST ? 1.5 : RECONNECT_SECONDS) * 1000,
  turnMs: (FAST ? 4 : TURN_SECONDS) * 1000,
  botMs: () => (FAST ? 20 : 700 + Math.random() * 600),
  closeMs: FAST ? 100 : 5000,
};

interface Seat extends SeatInfo {
  client?: Client;
  connected: boolean;
  botControlled: boolean;
  ready: boolean;
}

/**
 * One table. Server-authoritative: holds private game state, sends per-seat views.
 * Seat lifecycle: join (lobby only) -> play -> hand end (kick broke players) -> lobby again.
 * Drop mid-hand: whole table pauses RECONNECT_SECONDS; no return => bot finishes the hand, then kick.
 */
export class TableRoom extends Room {
  engine!: GameEngine;
  code = "";
  gameId!: GameId;
  phase: RoomPhase = "lobby";
  hostSeat = 0;
  dealerSeat: number | null = null;
  baseBet = 1000;
  flags: Record<string, boolean | number> = {};
  seats: (Seat | null)[] = [];
  gs: any = null;
  pending = new Map<number, number>(); // seat -> reconnect deadline (epoch ms)
  turnDeadline: number | null = null;
  rng = secureRng();
  botCount = 0;
  lastChat = new Map<string, number>();

  async onAuth(_c: Client, options: any) {
    const user = await authenticate(options);
    if (this.phase !== "lobby") throw new Error("Phòng đang chơi, không thể vào giữa ván");
    if (this.seats.some((s) => s && s.id === user.userId)) throw new Error("Tài khoản đã ở trong phòng");
    return user;
  }

  onCreate(options: any) {
    const engine = engines[options?.gameId as GameId];
    if (!engine) throw new Error("Game chưa sẵn sàng");
    this.engine = engine;
    this.gameId = options.gameId;
    this.code = roomCode();
    this.roomId = this.code;
    this.maxClients = engine.meta.maxPlayers;
    this.seats = Array.from({ length: engine.meta.maxPlayers }, () => null);
    this.flags = { ...engine.meta.rulesFlags };
    const bet = Math.floor(Number(options.baseBet));
    if (bet >= 1 && bet <= 1_000_000) this.baseBet = bet;
    this.onMessage("m", (client, msg: C2S) => {
      void this.handle(client, msg).catch((e) => {
        console.error("[table] handler error", e);
        client.send("error", { text: "Lỗi máy chủ" });
      });
    });
  }

  async onJoin(client: Client, _o: any, user: AuthUser) {
    const free = this.seats.findIndex((s) => !s);
    if (free < 0) throw new Error("Phòng đầy");
    const chips = await store.getChips(user.userId);
    this.seats[free] = {
      seat: free, id: user.userId, name: user.name, isBot: false, chips,
      client, connected: true, botControlled: false, ready: false,
    };
    if (this.humans().length === 1) this.hostSeat = free;
    client.send("me", { seat: free });
    this.pushRoom();
  }

  async onLeave(client: Client, consented: boolean) {
    const idx = this.seatOf(client);
    if (idx < 0) return;
    const s = this.seats[idx]!;
    s.connected = false;
    s.client = undefined;

    if (this.phase === "lobby") {
      this.freeSeat(idx);
      this.pushRoom();
      return;
    }

    if (consented) {
      this.makeBot(idx, `${s.name} đã thoát, máy đánh thay đến hết ván`);
      this.afterMembershipChange();
      return;
    }

    // dropped: pause everyone and wait
    this.pending.set(idx, Date.now() + T.reconnectMs);
    if (this.phase === "playing") this.phase = "paused";
    this.clock.clear();
    this.turnDeadline = null;
    this.notice("paused", `${s.name} mất kết nối, chờ ${Math.round(T.reconnectMs / 1000)} giây`, idx);
    this.pushRoom();
    try {
      const back = await this.allowReconnection(client, Math.ceil(T.reconnectMs / 1000));
      s.client = back;
      s.connected = true;
      this.pending.delete(idx);
      this.notice("resumed", `${s.name} đã quay lại`, idx);
      this.resumeIfClear();
    } catch {
      this.pending.delete(idx);
      this.makeBot(idx, `${s.name} đã rời hẳn, máy đánh thay đến hết ván`);
      this.afterMembershipChange();
    }
  }

  // ---------- message handling ----------
  private async handle(client: Client, m: C2S) {
    const me = this.seatOf(client);
    if (me < 0 || !m || typeof (m as any).t !== "string") return;
    const isHost = me === this.hostSeat;
    const err = (text: string) => client.send("error", { text });
    const lobbyHost = () => {
      if (!isHost) return err("Chỉ chủ phòng mới làm được"), false;
      if (this.phase !== "lobby") return err("Chỉ làm được ở phòng chờ"), false;
      return true;
    };

    switch (m.t) {
      case "sync": {
        // client registers handlers first, then asks for state (messages sent during join can be missed)
        client.send("me", { seat: me });
        client.send("room", this.info());
        if (this.gs && this.phase !== "lobby") {
          client.send("view", { seat: me, view: this.engine.view(this.gs, me), toAct: this.engine.toAct(this.gs), deadline: this.turnDeadline });
        }
        return;
      }
      case "addBot": {
        if (!lobbyHost()) return;
        const chips = await store.getChips("bot-default");
        if (this.phase !== "lobby") return; // state may have changed while awaiting
        const free = this.seats.findIndex((s) => !s);
        if (free < 0) return err("Phòng đầy");
        this.botCount++;
        this.seats[free] = {
          seat: free, id: `bot:${this.botCount}`, name: `Máy ${this.botCount}`, isBot: true,
          chips, connected: true, botControlled: false, ready: true,
        };
        return this.pushRoom();
      }
      case "removeBot": {
        if (!lobbyHost()) return;
        const s = this.seats[m.seat];
        if (!s?.isBot) return err("Không phải máy");
        this.freeSeat(m.seat);
        return this.pushRoom();
      }
      case "kick": {
        if (!lobbyHost()) return;
        const s = this.seats[m.seat];
        if (!s || m.seat === me) return err("Không kick được");
        if (s.isBot) this.freeSeat(m.seat);
        else {
          s.client?.send("kicked", { reason: "Bị chủ phòng mời ra" });
          s.client?.leave();
        }
        return this.pushRoom();
      }
      case "setDealer": {
        if (!lobbyHost()) return;
        if (!this.engine.meta.hasDealer) return err("Game này không có cái");
        if (!this.seats[m.seat]) return err("Ghế trống");
        this.dealerSeat = m.seat;
        this.notice("dealer_changed", `${this.seats[m.seat]!.name} làm cái`, m.seat);
        return this.pushRoom();
      }
      case "setBet": {
        if (!lobbyHost()) return;
        const b = Math.floor(Number(m.baseBet));
        if (!(b >= 1 && b <= 1_000_000)) return err("Mức cược không hợp lệ");
        this.baseBet = b;
        return this.pushRoom();
      }
      case "setFlag": {
        if (!lobbyHost()) return;
        const def = this.engine.meta.rulesFlags[m.key];
        if (def === undefined || typeof def !== typeof m.value) return err("Luật không hợp lệ");
        this.flags[m.key] = m.value;
        return this.pushRoom();
      }
      case "start": {
        if (!lobbyHost()) return;
        return this.tryStart(client);
      }
      case "action": {
        if (this.phase !== "playing") return err("Ván đang tạm dừng hoặc chưa bắt đầu");
        if (!this.engine.toAct(this.gs).includes(me)) return err("Chưa đến lượt");
        const r = this.engine.apply(this.gs, me, m.a);
        if ("error" in r) return err(r.error);
        this.gs = r.state;
        return this.afterChange();
      }
      case "chat": {
        const text = String(m.text ?? "").trim().slice(0, 200);
        const now = Date.now();
        if (!text || now - (this.lastChat.get(client.sessionId) ?? 0) < 500) return;
        this.lastChat.set(client.sessionId, now);
        return this.broadcast("chat", { seat: me, name: this.seats[me]!.name, text });
      }
    }
  }

  // ---------- game flow ----------
  private tryStart(client: Client) {
    const occ = this.seats.filter((s): s is Seat => !!s);
    const { minPlayers, hasDealer } = this.engine.meta;
    if (occ.length < minPlayers) return client.send("error", { text: `Cần ít nhất ${minPlayers} người` });
    if (hasDealer && (this.dealerSeat === null || !this.seats[this.dealerSeat]))
      return client.send("error", { text: "Chưa chọn nhà cái" });
    const poor = occ.find((s) => s.chips < this.baseBet);
    if (poor) return client.send("error", { text: `${poor.name} không đủ tiền cược` });

    this.gs = this.engine.init({
      seats: occ.map(({ seat, id, name, isBot, chips }) => ({ seat, id, name, isBot, chips })),
      dealerSeat: hasDealer ? this.dealerSeat! : undefined,
      baseBet: this.baseBet,
      rng: this.rng,
      flags: this.flags,
    });
    this.phase = "playing";
    this.pushRoom();
    this.afterChange();
  }

  private afterChange() {
    this.pushViews();
    if (this.engine.isOver(this.gs)) return void this.finishHand();
    this.schedule();
  }

  private schedule() {
    this.clock.clear();
    this.turnDeadline = null;
    if (this.phase !== "playing") return;
    const toAct = this.engine.toAct(this.gs);
    let humanWaiting = false;
    for (const seat of toAct) {
      const s = this.seats[seat];
      if (!s) continue;
      if (s.isBot || s.botControlled) this.clock.setTimeout(() => this.botMove(seat), T.botMs());
      else {
        humanWaiting = true;
        this.clock.setTimeout(() => this.botMove(seat, true), T.turnMs); // timeout => safe default action
      }
    }
    if (humanWaiting) {
      this.turnDeadline = Date.now() + T.turnMs;
      this.pushViews();
    }
  }

  private botMove(seat: number, timeout = false) {
    if (this.phase !== "playing" || !this.engine.toAct(this.gs).includes(seat)) return;
    const act = timeout && this.engine.timeoutAction ? this.engine.timeoutAction(this.gs, seat) : this.engine.bot(this.gs, seat, this.rng);
    let r = this.engine.apply(this.gs, seat, act);
    if ("error" in r) {
      const legal = this.engine.legalActions(this.gs, seat);
      console.error("[table] bot illegal move:", r.error);
      if (!legal.length) return;
      r = this.engine.apply(this.gs, seat, legal[0]);
      if ("error" in r) return;
    }
    this.gs = r.state;
    this.afterChange();
  }

  private async finishHand() {
    this.clock.clear();
    const payouts = this.engine.settle(this.gs);
    const sum = payouts.reduce((a, p) => a + p.delta, 0);
    if (sum !== 0 && !this.engine.meta.houseBanked) {
      console.error("[table] settle not zero-sum, aborting hand", sum);
      this.phase = "lobby";
      return this.pushRoom();
    }
    for (const p of payouts) {
      const s = this.seats[p.seat];
      if (!s) continue;
      s.chips = Math.max(0, s.chips + p.delta);
      if (!s.isBot) await store.setChips(s.id, s.chips);
    }
    this.broadcast("result", {
      payouts,
      seats: this.seats.filter((s): s is Seat => !!s).map(({ seat, id, name, isBot, chips }) => ({ seat, id, name, isBot, chips })),
    });

    const broke = (s: Seat) => s.chips < this.baseBet;
    // dealer broke => close room
    const d = this.dealerSeat !== null ? this.seats[this.dealerSeat] : null;
    if (this.engine.meta.hasDealer && d && broke(d)) {
      this.notice("dealer_broke_closed", `Nhà cái ${d.name} hết tiền, phòng sẽ đóng`, d.seat);
      this.phase = "lobby";
      this.clock.setTimeout(() => void this.disconnect(), T.closeMs);
      return;
    }
    // kick broke players and humans who left mid-hand
    for (const s of this.seats.slice()) {
      if (!s) continue;
      if (s.botControlled && !s.isBot) this.freeSeat(s.seat);
      else if (broke(s)) {
        if (!s.isBot) {
          this.notice("player_broke_kicked", `${s.name} hết tiền, bị mời ra khỏi bàn`, s.seat);
          s.client?.send("kicked", { reason: "Hết tiền" });
        }
        const c = s.client;
        this.freeSeat(s.seat);
        c?.leave();
      }
    }
    this.phase = "lobby";
    if (this.humans().length === 0) return void this.disconnect();
    for (const s of this.seats) if (s && !s.isBot) s.ready = false;
    this.gs = null;
    this.pushRoom();
  }

  // ---------- helpers ----------
  private makeBot(idx: number, text: string) {
    const s = this.seats[idx];
    if (!s) return;
    s.botControlled = true;
    this.notice("player_left_bot", text, idx);
  }

  private afterMembershipChange() {
    if (this.humans().length === 0 && this.pending.size === 0) return void this.disconnect();
    this.pushRoom();
    this.resumeIfClear();
  }

  private resumeIfClear() {
    if (this.phase === "paused" && this.pending.size === 0) {
      this.phase = "playing";
      this.notice("resumed", "Tiếp tục ván", undefined);
    }
    this.pushRoom();
    if (this.phase === "playing") {
      if (this.engine.isOver(this.gs)) return void this.finishHand();
      this.pushViews();
      this.schedule();
    }
  }

  /** human seats that still count (connected or being waited for). */
  private humans() {
    return this.seats.filter((s): s is Seat => !!s && !s.isBot && !s.botControlled && (s.connected || this.pending.has(s.seat)));
  }

  private seatOf(client: Client) {
    return this.seats.findIndex((s) => s?.client?.sessionId === client.sessionId);
  }

  private freeSeat(idx: number) {
    this.seats[idx] = null;
    if (this.dealerSeat === idx) this.dealerSeat = null;
    if (this.hostSeat === idx) {
      const next = this.seats.find((s): s is Seat => !!s && !s.isBot && !s.botControlled && s.connected);
      if (next) this.hostSeat = next.seat;
    }
  }

  private notice(code: NoticeCode, text: string, seat?: number) {
    this.broadcast("notice", { code, text, seat });
  }

  private info(): RoomInfo {
    const seats: (PublicSeat | null)[] = this.seats.map((s) =>
      s ? { seat: s.seat, id: s.id, name: s.name, isBot: s.isBot, chips: s.chips, connected: s.connected, botControlled: s.botControlled, ready: s.ready } : null,
    );
    return {
      code: this.code, gameId: this.gameId, phase: this.phase, hostSeat: this.hostSeat, dealerSeat: this.dealerSeat,
      baseBet: this.baseBet, maxPlayers: this.engine.meta.maxPlayers, minPlayers: this.engine.meta.minPlayers,
      hasDealer: this.engine.meta.hasDealer, seats, flags: this.flags,
      paused: this.pending.size ? { seats: [...this.pending.keys()], until: Math.max(...this.pending.values()) } : undefined,
    };
  }

  private pushRoom() {
    this.broadcast("room", this.info());
  }

  private pushViews() {
    if (!this.gs) return;
    const toAct = this.engine.toAct(this.gs);
    for (const s of this.seats) {
      if (!s || s.isBot || !s.client || !s.connected) continue;
      s.client.send("view", { seat: s.seat, view: this.engine.view(this.gs, s.seat), toAct, deadline: this.turnDeadline });
    }
  }
}
