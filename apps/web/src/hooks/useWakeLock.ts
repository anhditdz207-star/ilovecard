import { useEffect } from "react";

export function useWakeLock(active: boolean) {
  useEffect(() => {
    let request: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      if (!active || document.hidden || !("wakeLock" in navigator)) return;
      try {
        request = await navigator.wakeLock.request("screen");
        if (!alive) await request.release();
      } catch { /* unsupported or denied by the browser */ }
    };
    const visible = () => { if (document.hidden) { void request?.release(); request = null; } else { void acquire(); } };
    void acquire();
    document.addEventListener("visibilitychange", visible);
    return () => { alive = false; document.removeEventListener("visibilitychange", visible); void request?.release(); };
  }, [active]);
}
