const colors = { gold: "#e6b64f", green: "#3ca875", blue: "#5798db", black: "#47505b", red: "#d55250" } as const;

export function Chip({ denomination, color = "gold", className = "" }: { denomination: number | string; color?: keyof typeof colors; className?: string }) {
  return <span className={`cg-chip ${className}`} style={{ "--cg-chip-color": colors[color] } as React.CSSProperties}>{denomination}</span>;
}
