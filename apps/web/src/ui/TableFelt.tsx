import type { PropsWithChildren } from "react";

export function TableFelt({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`cg-table-felt ${className}`}><div className="cg-table-felt-center" aria-hidden="true">♠</div><div className="cg-table-felt-content">{children}</div></div>;
}
