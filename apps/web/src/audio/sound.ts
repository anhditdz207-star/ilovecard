export type SoundName = "dealCard" | "flipCard" | "placeCard" | "shuffle" | "chipBet" | "chipPile" | "chipWin" | "turnPing" | "timerTick" | "pass" | "chop" | "win" | "lose" | "jackpot" | "baiThangTrang" | "buttonClick" | "notify" | "error";
export type SoundSettings = { master: number; sfx: number; music: number; muted: boolean; ambient: boolean; haptics: boolean };
const STORAGE = "cg-sound-settings";
const defaults: SoundSettings = { master: .8, sfx: .72, music: .14, muted: false, ambient: false, haptics: true };
let settings: SoundSettings = { ...defaults };
let context: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let music: GainNode | null = null;
let ambientNodes: OscillatorNode[] = [];
const listeners = new Set<(settings: SoundSettings) => void>();

try { if (typeof localStorage !== "undefined") settings = { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE) ?? "{}") }; } catch { /* use defaults */ }

function setup() {
  if (context || typeof window === "undefined" || !window.AudioContext) return;
  context = new AudioContext(); master = context.createGain(); sfx = context.createGain(); music = context.createGain();
  sfx.connect(master); music.connect(master); master.connect(context.destination);
  applyVolumes();
}
function applyVolumes() {
  if (!context || !master || !sfx || !music) return;
  const muted = settings.muted ? 0 : 1;
  master.gain.setTargetAtTime(settings.master * (document.hidden ? .35 : 1) * muted, context.currentTime, .025);
  sfx.gain.setTargetAtTime(settings.sfx, context.currentTime, .025);
  music.gain.setTargetAtTime(settings.ambient ? settings.music : 0, context.currentTime, .025);
}
export function unlockSound() { setup(); if (context?.state === "suspended") void context.resume(); }
export function getSoundSettings() { return { ...settings }; }
export function subscribeSoundSettings(fn: (value: SoundSettings) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function updateSoundSettings(patch: Partial<SoundSettings>) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch { /* storage can be unavailable */ }
  setup(); ensureAmbient(); applyVolumes(); listeners.forEach((fn) => fn({ ...settings }));
}

const tones: Record<SoundName, { notes: number[]; duration: number; noise?: number }> = {
  dealCard: { notes: [520], duration: .075, noise: .025 }, flipCard: { notes: [610, 760], duration: .09, noise: .018 }, placeCard: { notes: [390], duration: .1, noise: .035 }, shuffle: { notes: [280, 360, 310], duration: .28, noise: .12 },
  chipBet: { notes: [740, 980], duration: .09, noise: .02 }, chipPile: { notes: [460, 610, 790], duration: .2, noise: .055 }, chipWin: { notes: [660, 830, 990], duration: .38, noise: .035 }, turnPing: { notes: [880], duration: .13 }, timerTick: { notes: [1040], duration: .045 },
  pass: { notes: [300], duration: .085 }, chop: { notes: [180, 540], duration: .16, noise: .08 }, win: { notes: [660, 830, 990, 1320], duration: .48 }, lose: { notes: [440, 330, 260], duration: .4 }, jackpot: { notes: [660, 880, 1100, 1320, 1760], duration: .72, noise: .12 }, baiThangTrang: { notes: [523, 659, 784, 1047, 1319, 1568], duration: .9, noise: .1 }, buttonClick: { notes: [560], duration: .04 }, notify: { notes: [620, 820], duration: .18 }, error: { notes: [220, 180], duration: .16, noise: .035 },
};
function noiseBurst(duration: number, at: number, volume: number) {
  if (!context || !sfx || volume <= 0) return;
  const length = Math.ceil(context.sampleRate * duration), buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
  source.buffer = buffer; filter.type = "highpass"; filter.frequency.value = 800; gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.001, at + duration);
  source.connect(filter).connect(gain).connect(sfx); source.start(at);
}
export function play(name: SoundName) {
  unlockSound();
  if (!context || !sfx || settings.muted) return;
  const sound = tones[name], now = context.currentTime;
  sound.notes.forEach((frequency, i) => {
    const at = now + i * Math.min(.065, sound.duration / sound.notes.length), osc = context!.createOscillator(), gain = context!.createGain();
    osc.type = name === "chop" ? "triangle" : "sine"; osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.055 / (i + 1), at + .008); gain.gain.exponentialRampToValueAtTime(.0001, at + sound.duration);
    osc.connect(gain).connect(sfx!); osc.start(at); osc.stop(at + sound.duration + .01);
  });
  if (sound.noise) noiseBurst(Math.min(.18, sound.duration), now, sound.noise);
}
export function vibrate(kind: "turn" | "win" = "turn") { if (settings.haptics && typeof navigator !== "undefined") navigator.vibrate?.(kind === "win" ? [35, 35, 70] : 22); }
function ensureAmbient() {
  if (!context || !music) return;
  if (!settings.ambient && ambientNodes.length) { ambientNodes.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } }); ambientNodes = []; }
  if (settings.ambient && ambientNodes.length === 0) {
    [130.81, 164.81, 196].forEach((frequency, index) => { const osc = context!.createOscillator(), gain = context!.createGain(); osc.type = "sine"; osc.frequency.value = frequency; gain.gain.value = index === 0 ? .012 : .007; osc.connect(gain).connect(music!); osc.start(); ambientNodes.push(osc); });
  }
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => applyVolumes());
  const unlockOnce = () => { unlockSound(); window.removeEventListener("pointerdown", unlockOnce); window.removeEventListener("keydown", unlockOnce); };
  window.addEventListener("pointerdown", unlockOnce, { once: true }); window.addEventListener("keydown", unlockOnce, { once: true });
}
