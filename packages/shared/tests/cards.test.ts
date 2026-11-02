import { describe, it, expect } from "vitest";
import { makeDeck, shuffle, seededRng, cardKey } from "../src";

describe("cards", () => {
  it("deck has 52 unique cards", () => {
    const d = makeDeck();
    expect(d.length).toBe(52);
    expect(new Set(d.map(cardKey)).size).toBe(52);
  });
  it("shuffle is a deterministic permutation", () => {
    const a = shuffle(seededRng(1), makeDeck());
    const b = shuffle(seededRng(1), makeDeck());
    expect(a).toEqual(b);
    expect(new Set(a.map(cardKey)).size).toBe(52);
    expect(a).not.toEqual(makeDeck());
  });
});
