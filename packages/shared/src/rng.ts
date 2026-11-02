export interface RNG {
  /** float in [0,1) */
  next(): number;
  /** int in [0,n) */
  int(n: number): number;
}

/** Deterministic RNG for tests. */
export function seededRng(seed: number): RNG {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

/** Cryptographically secure RNG for production shuffles (server only). */
export function secureRng(): RNG {
  const next = () => {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    // 53-bit float
    return (buf[0]! * 2 ** 21 + (buf[1]! >>> 11)) / 2 ** 53;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}
