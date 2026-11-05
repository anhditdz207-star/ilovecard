import { ChipStack } from "../components/ChipStack";

export function Avatar({ name, chips, active = false, dealer = false, host = false, bot = false, seconds, emoji }: { name: string; chips: number; active?: boolean; dealer?: boolean; host?: boolean; bot?: boolean; seconds?: number | null; emoji?: string }) {
  const badge = dealer ? "🏦" : host ? "👑" : bot ? "🤖" : "";
  return <div className={`cg-avatar ${active ? "is-active" : ""}`}>
    <div className="cg-avatar-portrait" aria-hidden="true">{emoji ?? name.trim().slice(0, 1).toUpperCase()}{badge && <span>{badge}</span>}</div>
    <div className="min-w-0"><b className="block truncate text-sm">{name}</b><ChipStack value={chips} label="Chip" compact /></div>
    {active && seconds != null && <svg className="cg-avatar-timer" viewBox="0 0 44 44" aria-label={`${seconds} giây còn lại`}><circle cx="22" cy="22" r="19" pathLength="100"/><circle className="cg-avatar-timer-progress" cx="22" cy="22" r="19" pathLength="100" style={{ strokeDashoffset: `${Math.max(0, 100 - seconds / 30 * 100)}%` }} /></svg>}
  </div>;
}
