import { describe, it, expect } from "vitest";
import { restBucket, catStep } from "./catStep.js";

describe("restBucket", () => {
  it("floors to nearest 5", () => {
    expect(restBucket(0)).toBe(0);
    expect(restBucket(4)).toBe(0);
    expect(restBucket(7)).toBe(5);
    expect(restBucket(47)).toBe(45);
    expect(restBucket(100)).toBe(100);
  });
  it("clamps out-of-range input", () => {
    expect(restBucket(-10)).toBe(0);
    expect(restBucket(140)).toBe(100);
  });
});

describe("catStep", () => {
  it("same bucket → hop, walking", () => {
    expect(catStep(45, 45, 46)).toEqual({ move: "hop", pose: "walking" });
  });
  it("bucket up → walk-forward, walking", () => {
    expect(catStep(45, 50, 50)).toEqual({ move: "walk-forward", pose: "walking" });
  });
  it("bucket down → walk-backward, walking", () => {
    expect(catStep(50, 45, 48)).toEqual({ move: "walk-backward", pose: "walking" });
  });
  it("progress 100 → happy pose", () => {
    expect(catStep(95, 100, 100)).toEqual({ move: "walk-forward", pose: "happy" });
  });
  it("no delta → none", () => {
    expect(catStep(20, 20, 20)).toEqual({ move: "none", pose: "walking" });
  });
  it("hop at 100 stays happy", () => {
    expect(catStep(100, 100, 100)).toEqual({ move: "none", pose: "happy" });
  });
});
