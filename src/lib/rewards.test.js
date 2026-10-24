import { describe, expect, it } from "vitest";
import { LEVEL_COUNT, getReward, levelForProgress, percentLeft } from "./rewards";

describe("rewards", () => {
  it("starts at level 0 and reaches the last level only at 100%", () => {
    expect(levelForProgress(0, 100)).toBe(0);
    expect(levelForProgress(99, 100)).toBe(29);
    expect(levelForProgress(100, 100)).toBe(LEVEL_COUNT);
    expect(levelForProgress(0, 0)).toBe(0);
  });

  it("levels up roughly every 3 rows out of 100", () => {
    expect(levelForProgress(3, 100)).toBe(0);
    expect(levelForProgress(4, 100)).toBe(1);
    expect(levelForProgress(7, 100)).toBe(2);
  });

  it("is exact at level boundaries despite float error", () => {
    expect(levelForProgress(1, 30)).toBe(1);
    expect(levelForProgress(10, 30)).toBe(10);
    expect(levelForProgress(29, 30)).toBe(29);
  });

  it("reports percent left without showing 0% before completion", () => {
    expect(percentLeft(0, 200)).toBe(100);
    expect(percentLeft(100, 200)).toBe(50);
    expect(percentLeft(199, 200)).toBe(1);
    expect(percentLeft(200, 200)).toBe(0);
  });

  it("gives every level a distinct title and emoji", () => {
    const rewards = Array.from({ length: LEVEL_COUNT }, (_, i) => getReward(i + 1));
    expect(new Set(rewards.map((r) => r.title)).size).toBe(LEVEL_COUNT);
    expect(new Set(rewards.map((r) => r.emoji)).size).toBe(LEVEL_COUNT);
    expect(new Set(rewards.map((r) => r.colors.join())).size).toBe(LEVEL_COUNT);
  });
});
