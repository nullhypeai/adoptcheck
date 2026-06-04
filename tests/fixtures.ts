import type { RepoSnapshot } from "@/lib/types";

type SnapshotOverrides = Omit<Partial<RepoSnapshot>, "repo"> & {
  repo?: Partial<RepoSnapshot["repo"]>;
};

export function fixtureSnapshot(overrides: SnapshotOverrides = {}): RepoSnapshot {
  const base: RepoSnapshot = {
    repo: {
      owner: "example",
      name: "healthy",
      fullName: "example/healthy",
      description: "Automation toolkit for developer workflows",
      htmlUrl: "https://github.com/example/healthy",
      stars: 1280,
      forks: 120,
      openIssues: 12,
      defaultBranch: "main",
      language: "TypeScript",
      topics: ["automation", "developer-tools"],
      archived: false,
      pushedAt: new Date().toISOString(),
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: new Date().toISOString(),
      license: {
        key: "mit",
        name: "MIT License",
        spdxId: "MIT"
      }
    },
    readme: "## Install\nnpm install\nnpm run build\nnpm test\nProduction-ready automation toolkit.",
    rootFiles: ["README.md", "LICENSE", "package.json", "package-lock.json", "vitest.config.ts", ".env.example", "Dockerfile"],
    workflowFiles: ["ci.yml"],
    releases: [{ name: "v1", tagName: "v1.0.0", publishedAt: "2025-01-01T00:00:00Z" }],
    latestCommitSha: "abc123",
    securityPolicyPresent: true,
    rateLimitRemaining: "4998"
  };

  return {
    ...base,
    ...overrides,
    repo: {
      ...base.repo,
      ...overrides.repo
    }
  };
}
