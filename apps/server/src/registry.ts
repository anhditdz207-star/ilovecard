import type { GameEngine, GameId } from "@cg/shared";
import { demoEngine } from "@cg/game-demo";
import { bauCuaEngine } from "@cg/game-bau-cua";
import { baccaratEngine } from "@cg/game-baccarat";
import { baiCaoEngine } from "@cg/game-bai-cao";
import { baiCaoToEngine } from "@cg/game-bai-cao-to";
import { xiDachEngine } from "@cg/game-xi-dach";
import { tienLenNamEngine, tienLenBacEngine } from "@cg/game-tien-len";

/** Register every finished game engine here. */
export const engines: Partial<Record<GameId, GameEngine>> = {
  demo: demoEngine,
  "bau-cua": bauCuaEngine,
  baccarat: baccaratEngine,
  "bai-cao": baiCaoEngine,
  "bai-cao-to": baiCaoToEngine,
  "xi-dach": xiDachEngine,
  "tien-len-nam": tienLenNamEngine,
  "tien-len-bac": tienLenBacEngine,
};
