import http from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { TableRoom } from "./rooms/TableRoom";
import { LobbyRoom } from "./rooms/LobbyRoom";

export function createGameServer(port: number) {
  const allowed = process.env.ALLOWED_ORIGIN ?? "*";
  const httpServer = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    if (req.url === "/health") return void res.writeHead(200).end("ok");
    // Colyseus matchmaking routes are handled by transport; fallthrough:
  });
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  gameServer.define("lobby", LobbyRoom);
  gameServer.define("table", TableRoom);
  return { gameServer, httpServer, listen: () => gameServer.listen(port) };
}

if (process.argv[1] && /index\.(ts|js)$/.test(process.argv[1])) {
  const port = Number(process.env.PORT ?? 2567);
  createGameServer(port).listen().then(() => console.log(`[server] listening on :${port}`));
}
