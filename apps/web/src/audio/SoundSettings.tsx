import { useEffect, useState } from "react";
import { getSoundSettings, subscribeSoundSettings, updateSoundSettings, type SoundSettings as Settings } from "./sound";

export function SoundSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Settings>(getSoundSettings());
  useEffect(() => subscribeSoundSettings(setValue), []);
  const change = (patch: Partial<Settings>) => { updateSoundSettings(patch); setValue(getSoundSettings()); };
  return <div className="relative">
    <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15" aria-expanded={open} onClick={() => setOpen(!open)}>{value.muted ? "🔇" : "🔊"} Âm thanh</button>
    {open && <div className="absolute right-0 z-30 mt-2 w-64 space-y-3 rounded-xl border border-amber-200/20 bg-emerald-950 p-4 shadow-xl">
      <div className="flex items-center justify-between"><b className="text-sm">Âm thanh</b><button type="button" className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => change({ muted: !value.muted })}>{value.muted ? "Bật tiếng" : "Tắt tiếng"}</button></div>
      {(["master", "sfx", "music"] as const).map((key) => <label key={key} className="block text-xs capitalize text-emerald-100/80">{key === "master" ? "Tổng" : key === "sfx" ? "Hiệu ứng" : "Nhạc nền"}<input className="mt-1 block w-full accent-amber-300" type="range" min="0" max="1" step=".01" value={value[key]} onChange={(e) => change({ [key]: Number(e.target.value) })} /></label>)}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.ambient} onChange={(e) => change({ ambient: e.target.checked })} /> Nhạc nền lounge (mặc định tắt)</label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.haptics} onChange={(e) => change({ haptics: e.target.checked })} /> Rung khi tới lượt / thắng</label>
    </div>}
  </div>;
}
