import type { Card as PlayingCard } from "@cg/shared";

const ranks: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const suits = { S: "♠", C: "♣", D: "♦", H: "♥" } as const;
type Props = {
  card?: PlayingCard | null; hidden?: boolean; selected?: boolean; size?: "sm" | "md" | "lg";
  delay?: number; onClick?: () => void; disabled?: boolean; className?: string;
};
function Face({ card, hidden }: { card?: PlayingCard | null; hidden: boolean }) {
  if (hidden || !card) return <span className="cg-card-back" aria-hidden="true"><i>✦</i></span>;
  const rank = ranks[card.rank] ?? String(card.rank), suit = suits[card.suit];
  const red = card.suit === "D" || card.suit === "H";
  return <span className={`cg-card-face ${red ? "is-red" : ""}`}><span className="cg-card-corner">{rank}<i>{suit}</i></span><b>{suit}</b><span className="cg-card-corner cg-card-corner--bottom">{rank}<i>{suit}</i></span></span>;
}
export function Card({ card, hidden = false, selected = false, size = "md", delay = 0, onClick, disabled = false, className = "" }: Props) {
  const classes = `cg-card cg-card--${size} ${hidden ? "is-hidden" : ""} ${selected ? "is-selected" : ""} ${onClick ? "is-interactive" : ""} ${className}`;
  const style = { animationDelay: `${delay}ms` };
  const label = hidden ? "Lá bài úp" : card ? `${ranks[card.rank] ?? card.rank} ${suits[card.suit]}` : "Lá bài";
  return onClick
    ? <button type="button" className={classes} style={style} aria-label={label} aria-pressed={selected} disabled={disabled} onClick={onClick}><Face card={card} hidden={hidden} /></button>
    : <div className={classes} style={style} role="img" aria-label={label}><Face card={card} hidden={hidden} /></div>;
}
