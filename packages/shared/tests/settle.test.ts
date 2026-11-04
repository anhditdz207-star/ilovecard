import { describe, it, expect } from "vitest";
import { settleVsDealer } from "../src";

const sum = (p: { delta: number }[]) => p.reduce((a, b) => a + b.delta, 0);

describe("settleVsDealer", () => {
  it("sums to zero and pays in full when dealer is rich", () => {
    const p = settleVsDealer(0, 1000, { 1: 500, 2: 500 }, [{ seat: 1, amount: 100 }, { seat: 2, amount: -100 }]);
    expect(sum(p)).toBe(0);
    expect(p.find((x) => x.seat === 1)!.delta).toBe(100);
  });
  it("dealer pays only what it has", () => {
    const p = settleVsDealer(0, 50, { 1: 500, 2: 500 }, [{ seat: 1, amount: 100 }, { seat: 2, amount: 100 }]);
    expect(sum(p)).toBe(0);
    expect(p.find((x) => x.seat === 1)!.delta).toBe(50);
    expect(p.find((x) => x.seat === 2)!.delta).toBe(0);
    expect(p.find((x) => x.seat === 0)!.delta).toBe(-50);
  });
  it("losers capped by their chips", () => {
    const p = settleVsDealer(0, 0, { 1: 30 }, [{ seat: 1, amount: -100 }]);
    expect(p.find((x) => x.seat === 1)!.delta).toBe(-30);
    expect(sum(p)).toBe(0);
  });
});

import { settleNet } from "../src";
describe("settleNet", () => {
  it("zero-sum and capped", () => {
    const p = settleNet({ 0: 1000, 1: 50, 2: 1000 }, { 0: 300, 1: -200, 2: -100 });
    expect(p.reduce((a, b) => a + b.delta, 0)).toBe(0);
    expect(p.find((x) => x.seat === 1)!.delta).toBe(-50);
    expect(p.find((x) => x.seat === 0)!.delta).toBe(150);
  });
  it("uncapped passes through, odd chips distributed", () => {
    const p = settleNet({ 0: 99, 1: 99, 2: 99, 3: 99 }, { 0: 3, 1: 1, 2: -1, 3: -3 });
    expect(p.find((x) => x.seat === 0)!.delta).toBe(3);
    const q = settleNet({ 0: 10, 1: 10, 2: 10 }, { 0: 1, 1: 1, 2: -2 });
    expect(q.reduce((a, b) => a + b.delta, 0)).toBe(0);
  });
});
