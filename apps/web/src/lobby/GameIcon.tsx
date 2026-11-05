import type { GameId } from "@cg/shared";

const marks: Partial<Record<GameId, string>> = { "bau-cua": "♟", baccarat: "B", "bai-cao": "3", "bai-cao-to": "♧", "xi-dach": "21", "tien-len-nam": "3", "tien-len-bac": "♠", poker: "A", demo: "✦" };
export function GameIcon({ id }: { id: GameId }) {
  return <svg viewBox="0 0 96 72" className="h-16 w-24 drop-shadow-lg" aria-hidden="true">
    {id === "bau-cua" ? <g transform="rotate(-8 48 36)"><rect x="7" y="10" width="42" height="42" rx="9" fill="#d94c43" stroke="#ffe3a1" strokeWidth="3"/><circle cx="19" cy="22" r="4" fill="white"/><circle cx="37" cy="40" r="4" fill="white"/><rect x="43" y="23" width="42" height="42" rx="9" fill="#dfa83d" stroke="#fff0c2" strokeWidth="3"/><circle cx="55" cy="35" r="4" fill="white"/><circle cx="73" cy="53" r="4" fill="white"/><circle cx="73" cy="35" r="4" fill="white"/></g> : <g transform="rotate(-8 48 36)"><rect x="17" y="8" width="43" height="57" rx="6" fill="#f8f4e9" stroke="#fff0c2" strokeWidth="2"/><rect x="37" y="13" width="43" height="57" rx="6" fill="#fffdf7" stroke="#ffe3a1" strokeWidth="2"/><text x="43" y="33" fill="#ae302a" fontSize="14" fontWeight="900">{marks[id] ?? "A"}</text><text x="46" y="53" fill="#ae302a" fontSize="20">{id.includes("bac") ? "♥" : "♠"}</text></g>}
  </svg>;
}
