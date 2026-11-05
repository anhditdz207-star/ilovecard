import { play, vibrate } from "../audio/sound";

export function useGameSounds() {
  return {
    card: () => play("dealCard"),
    chip: () => play("chipBet"),
    pass: () => play("pass"),
    chop: () => play("chop"),
    win: () => { play("win"); vibrate("win"); },
  };
}
