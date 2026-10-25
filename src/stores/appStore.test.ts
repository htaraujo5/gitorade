import { describe, expect, it } from "vitest";
import type { Repository } from "../lib/api";
import { repositoriesForWorkspace, shellTabsForWorkspace, type ShellTab } from "./appStore";

function repository(id: string, defaultProfileId: string | null): Repository {
  return {
    id,
    name: id,
    path: `/${id}`,
    defaultProfileId,
    isFavorite: false,
    createdAt: "",
    updatedAt: "",
  };
}

describe("workspace repository and tab visibility", () => {
  const repositories = [repository("repo-a", "profile-a"), repository("repo-b", "profile-b")];
  const tabs: ShellTab[] = [
    { id: "tab-start", kind: "start", title: "Start" },
    { id: "tab-repo-a", kind: "repo", repoId: "repo-a", title: "Repo A" },
    { id: "tab-settings", kind: "settings", title: "Settings" },
    { id: "tab-repo-b", kind: "repo", repoId: "repo-b", title: "Repo B" },
  ];

  it("shows only repositories owned by the active workspace", () => {
    expect(repositoriesForWorkspace(repositories, "profile-a").map((repo) => repo.id)).toEqual([
      "repo-a",
    ]);
    expect(
      repositoriesForWorkspace([...repositories, repository("unassigned", null)], "profile-a").map(
        (repo) => repo.id,
      ),
    ).toEqual(["repo-a"]);
  });

  it("shows repository tabs only in their owner's workspace", () => {
    expect(shellTabsForWorkspace(tabs, repositories, "profile-a").map((tab) => tab.id)).toEqual([
      "tab-start",
      "tab-repo-a",
      "tab-settings",
    ]);
  });

  it("keeps all repositories visible when no workspace is selected", () => {
    expect(repositoriesForWorkspace(repositories, null)).toEqual(repositories);
    expect(shellTabsForWorkspace(tabs, repositories, null)).toEqual(tabs);
  });
});
