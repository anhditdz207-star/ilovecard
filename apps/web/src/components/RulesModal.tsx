import { demoEngine } from "@cg/game-demo";
import type { GameId } from "@cg/shared";
import { bauCuaRulesText } from "@cg/game-bau-cua";
import { baccaratRulesText } from "@cg/game-baccarat";

const RULES: Partial<Record<GameId, string>> = { demo: demoEngine.rulesText, "bau-cua": bauCuaRulesText, baccarat: baccaratRulesText };

export function rulesFor(id: GameId) {
  return RULES[id] ?? "Luật chơi đang được cập nhật.";
}

export function RulesModal({ id, name, onClose }: { id: GameId; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-w-md rounded-xl bg-emerald-950 p-5 ring-1 ring-emerald-500/40" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-lg font-bold">Hướng dẫn: {name}</h3>
        <p className="whitespace-pre-line text-sm text-emerald-100/90">{rulesFor(id)}</p>
        <button className="mt-4 rounded bg-emerald-600 px-4 py-1.5" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
