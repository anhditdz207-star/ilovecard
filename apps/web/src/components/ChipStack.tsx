import { motion } from "framer-motion";

type Props = { value: number; label?: string; compact?: boolean };
export function ChipStack({ value, label = "Chip", compact = false }: Props) {
  return <div className={`cg-chip-stack ${compact ? "is-compact" : ""}`} aria-live="polite">
    <div className="cg-chips" aria-hidden="true"><i /><i /><i /></div>
    <motion.div key={value} className="cg-chip-value" initial={{ opacity: .5, y: 8, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .22 }}><span>{label}</span><b>{value.toLocaleString()}</b></motion.div>
  </div>;
}
