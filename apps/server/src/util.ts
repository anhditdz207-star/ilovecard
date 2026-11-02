const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function roomCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
