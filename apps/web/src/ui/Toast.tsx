export function Toast({ children, tone = "info", onClose }: { children: React.ReactNode; tone?: "info" | "success" | "error"; onClose?: () => void }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`cg-toast cg-toast-${tone}`}>{children}{onClose && <button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button>}</div>;
}
