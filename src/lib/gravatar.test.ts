import { describe, expect, it } from "vitest";
import { md5Hex } from "./md5";
import { gravatarUrl } from "./gravatar";

describe("md5Hex", () => {
  it("matches RFC test vector for empty string", () => {
    expect(md5Hex("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  it("matches Gravatar example email", () => {
    // Well-known: MD5 of "helisson@example.com" — verify "test@example.com"
    expect(md5Hex("test@example.com")).toBe("55502f40dc8b7c769880b10874abc9d0");
  });
});

describe("gravatarUrl", () => {
  it("builds URL with normalized email", () => {
    const url = gravatarUrl("  Test@Example.COM ", 64);
    expect(url).toBe(
      "https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=64&d=404&r=g",
    );
  });

  it("returns null for empty email", () => {
    expect(gravatarUrl("")).toBeNull();
    expect(gravatarUrl("not-an-email")).toBeNull();
  });
});
