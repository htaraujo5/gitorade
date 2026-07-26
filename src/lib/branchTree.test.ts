import { describe, expect, it } from "vitest";
import { buildBranchTree } from "./branchTree";

describe("buildBranchTree", () => {
  it("groups fix/ and feat/ folders", () => {
    const tree = buildBranchTree([
      { name: "fix/TXKB-2166" },
      { name: "feat/login" },
      { name: "master" },
      { name: "developer" },
    ]);
    expect(tree.map((n) => (n.kind === "folder" ? n.name : n.label))).toEqual([
      "feat",
      "fix",
      "developer",
      "master",
    ]);
    const fix = tree.find((n) => n.kind === "folder" && n.name === "fix");
    expect(fix?.kind).toBe("folder");
    if (fix?.kind === "folder") {
      expect(fix.children).toEqual([
        { kind: "branch", fullName: "fix/TXKB-2166", label: "TXKB-2166" },
      ]);
    }
  });

  it("strips remote prefix before nesting", () => {
    const tree = buildBranchTree(
      [
        { name: "origin/fix/TXKB-1" },
        { name: "origin/6.22" },
        { name: "origin/feat/x" },
      ],
      "origin/",
    );
    expect(tree.map((n) => (n.kind === "folder" ? n.name : n.label))).toEqual([
      "feat",
      "fix",
      "6.22",
    ]);
  });
});
