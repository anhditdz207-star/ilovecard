export type SeatPoint = { seat: number; x: number; y: number };

/** Put seat 0 at the bottom, then distribute other seats clockwise around an oval. */
export function layoutSeats(count: number): SeatPoint[] {
  if (!Number.isInteger(count) || count < 1) return [];
  return Array.from({ length: count }, (_, seat) => {
    const angle = Math.PI / 2 + (seat * Math.PI * 2) / count;
    return { seat, x: 50 + 43 * Math.cos(angle), y: 50 + 43 * Math.sin(angle) };
  });
}
