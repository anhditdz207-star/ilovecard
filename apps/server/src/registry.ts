import type { GameEngine, GameId } from "@cg/shared";
import { demoEngine } from "@cg/game-demo";

/** Register every finished game engine here. */
export const engines: Partial<Record<GameId, GameEngine>> = {
  demo: demoEngine,
};
