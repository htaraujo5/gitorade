import { describe, expect, it } from "vitest";
import { validateRefName } from "./refName";

describe("validateRefName", () => {
  it("accepts common branch and tag names", () => {
    expect(validateRefName("feat/login")).toBeNull();
    expect(validateRefName("v2.1.0")).toBeNull();
    expect(validateRefName("fix-123")).toBeNull();
  });

  it("rejects invalid names", () => {
    expect(validateRefName("")).not.toBeNull();
    expect(validateRefName("my branch")).not.toBeNull();
    expect(validateRefName("-oops")).not.toBeNull();
    expect(validateRefName("a..b")).not.toBeNull();
    expect(validateRefName("feat/")).not.toBeNull();
    expect(validateRefName("x.lock")).not.toBeNull();
    expect(validateRefName("what?")).not.toBeNull();
    expect(validateRefName("HEAD")).not.toBeNull();
  });
});
