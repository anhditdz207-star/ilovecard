type Props = { value: number; label?: string; compact?: boolean };
export function ChipStack({ value, label = "Chip", compact = false }: Props) {
  return <div className={`cg-chip-stack ${compact ? "is-compact" : ""}`} aria-live="polite">
    <div className="cg-chips" aria-hidden="true"><i /><i /><i /></div>
    <div key={value} className="cg-chip-value"><span>{label}</span><b>{value.toLocaleString()}</b></div>
  </div>;
}
