import type { GameEngine, GameId } from "@cg/shared";
import { demoEngine } from "@cg/game-demo";
import { bauCuaEngine } from "@cg/game-bau-cua";
import { baccaratEngine } from "@cg/game-baccarat";
import { baiCaoEngine } from "@cg/game-bai-cao";

/** Register every finished game engine here. */
export const engines: Partial<Record<GameId, GameEngine>> = {
  demo: demoEngine,
  "bau-cua": bauCuaEngine,
  baccarat: baccaratEngine,
  "bai-cao": baiCaoEngine,
};
