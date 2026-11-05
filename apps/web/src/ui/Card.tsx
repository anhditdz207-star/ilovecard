import type { Card as PlayingCard } from "@cg/shared";

const rankLabel = (rank: number) => ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[rank] ?? String(rank);
const suitLabel = { S: "♠", C: "♣", D: "♦", H: "♥" } as const;
const redSuit = (suit: PlayingCard["suit"]) => suit === "D" || suit === "H";
type Props = { card?: PlayingCard | null; hidden?: boolean; faceDown?: boolean; selected?: boolean; dim?: boolean; highlight?: boolean; size?: "sm" | "md" | "lg"; delay?: number; onClick?: () => void; disabled?: boolean; className?: string };

export function Card({ card, hidden = false, faceDown = false, selected = false, dim = false, highlight = false, size = "md", delay = 0, onClick, disabled = false, className = "" }: Props) {
  const down = hidden || faceDown || !card;
  const suit = card ? suitLabel[card.suit] : "";
  const rank = card ? rankLabel(card.rank) : "";
  const pips = card && card.rank >= 2 && card.rank <= 10 ? Array.from({ length: card.rank }, (_, i) => <text key={i} x={50 + (i % 2 ? 12 : -12)} y={32 + Math.floor(i / 2) * 9} textAnchor="middle">{suit}</text>) : null;
  const classes = `cg-card cg-card--${size} ${down ? "is-hidden" : ""} ${selected ? "is-selected" : ""} ${dim ? "is-dim" : ""} ${highlight ? "is-highlight" : ""} ${onClick ? "is-interactive" : ""} ${className}`;
  const content = down ? <svg viewBox="0 0 100 140" aria-hidden="true"><defs><pattern id="cg-card-weave" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8 M4 0V8" stroke="#f4d58a" strokeOpacity=".38" strokeWidth="1.5" /></pattern></defs><rect x="5" y="5" width="90" height="130" rx="9" fill="#104e3a"/><rect x="9" y="9" width="82" height="122" rx="6" fill="url(#cg-card-weave)"/><path d="M50 28 72 70 50 112 28 70Z" fill="none" stroke="#f5d990" strokeWidth="2"/><circle cx="50" cy="70" r="7" fill="#f5d990"/></svg> : <svg viewBox="0 0 100 140" aria-hidden="true" className={redSuit(card!.suit) ? "is-red" : ""}>
    <rect x="3" y="3" width="94" height="134" rx="9" fill="#fffdf8" stroke="#ded9cd" />
    <text className="cg-svg-rank" x="10" y="19">{rank}</text><text className="cg-svg-suit" x="10" y="31">{suit}</text>
    <text className="cg-svg-rank" x="90" y="126" textAnchor="end" transform="rotate(180 90 120)">{rank}</text><text className="cg-svg-suit" x="90" y="114" textAnchor="end" transform="rotate(180 90 114)">{suit}</text>
    {pips ? <g className="cg-svg-pips">{pips}</g> : <g className="cg-svg-court"><rect x="28" y="38" width="44" height="64" rx="5" fill="#f3ead6" stroke="currentColor" strokeWidth="2"/><path d="M50 40 66 70 50 100 34 70Z" fill="#fff" stroke="currentColor" strokeWidth="2"/><circle cx="50" cy="57" r="7" fill="#d5aa53"/><path d="M38 86q12-16 24 0v8H38Z" fill="#173b31"/><text x="50" y="124" textAnchor="middle">{rank}</text></g>}
  </svg>;
  const label = down ? "Lá bài úp" : `${rank} ${suit}`;
  return onClick ? <button type="button" aria-label={label} aria-pressed={selected} disabled={disabled} className={classes} style={{ animationDelay: `${delay}ms` }} onClick={onClick}>{content}</button> : <div role="img" aria-label={label} className={classes} style={{ animationDelay: `${delay}ms` }}>{content}</div>;
}
