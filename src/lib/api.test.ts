import { describe, expect, it } from "vitest";
import { appHealthSchema, profileSchema, repoStatusSchema } from "./api";

describe("api schemas", () => {
  it("accepts a valid health payload", () => {
    const parsed = appHealthSchema.parse({
      appVersion: "0.1.0",
      git: {
        available: true,
        version: "git version 2.55.0",
        path: "C:\\\\Program Files\\\\Git\\\\cmd\\\\git.exe",
        message: "Git disponível.",
      },
      databaseReady: true,
    });

    expect(parsed.appVersion).toBe("0.1.0");
    expect(parsed.git.available).toBe(true);
  });

  it("accepts profile and status payloads", () => {
    const profile = profileSchema.parse({
      id: "1",
      name: "Helisson",
      email: "h@example.com",
      sshKeyPath: null,
      provider: "GitHub",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(profile.email).toContain("@");

    const status = repoStatusSchema.parse({
      branch: "main",
      staged: [{ path: "a.ts", status: "modified", staged: true }],
      unstaged: [],
    });
    expect(status.staged).toHaveLength(1);
  });
});
