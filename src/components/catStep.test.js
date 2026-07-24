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
  it("same bucket + row confirmed → hop, walking", () => {
    expect(catStep(45, 45, false, true)).toEqual({ move: "hop", pose: "walking" });
  });
  it("same bucket, no row change → none", () => {
    expect(catStep(45, 45, false, false)).toEqual({ move: "none", pose: "walking" });
  });
  it("bucket up → walk-forward, walking", () => {
    expect(catStep(45, 50, false, true)).toEqual({ move: "walk-forward", pose: "walking" });
  });
  it("bucket down → walk-backward, walking", () => {
    expect(catStep(50, 45, false, true)).toEqual({ move: "walk-backward", pose: "walking" });
  });
  it("complete crossing → walk-forward, happy", () => {
    expect(catStep(95, 100, true, true)).toEqual({ move: "walk-forward", pose: "happy" });
  });
  it("no delta → none", () => {
    expect(catStep(20, 20, false, false)).toEqual({ move: "none", pose: "walking" });
  });
  it("row change at 100 stays happy, no hop", () => {
    expect(catStep(100, 100, true, true)).toEqual({ move: "none", pose: "happy" });
  });
});
