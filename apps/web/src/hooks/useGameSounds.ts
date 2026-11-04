import { useCallback, useRef } from "react";

export function useGameSounds() {
  const audio = useRef<AudioContext | null>(null);
  const tone = useCallback((frequency: number, duration: number, type: OscillatorType = "sine") => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    const context = audio.current ?? (audio.current = new window.AudioContext());
    void context.resume();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }, []);
  return {
    card: () => tone(520, 0.07, "triangle"),
    chip: () => tone(760, 0.09, "sine"),
    pass: () => tone(300, 0.08, "sine"),
    chop: () => tone(940, 0.11, "triangle"),
    win: () => { tone(660, 0.12); setTimeout(() => tone(880, 0.16), 90); },
  };
}
