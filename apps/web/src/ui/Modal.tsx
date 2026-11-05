import type { PropsWithChildren } from "react";

export function Modal({ title, children, onClose }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return <div className="cg-modal-backdrop" onMouseDown={onClose}><section role="dialog" aria-modal="true" aria-label={title} className="cg-modal" onMouseDown={(e) => e.stopPropagation()}><header><h2>{title}</h2><button aria-label="Đóng" onClick={onClose}>×</button></header>{children}</section></div>;
}
