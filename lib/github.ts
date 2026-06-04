import { z } from "zod";
import type { RepoMetadata, RepoSnapshot } from "./types";

export const repoInputSchema = z.object({
  repo: z.string().trim().min(3).max(240)
});

export interface ParsedRepo {
  owner: string;
  repo: string;
}

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  language: string | null;
  topics?: string[];
  archived: boolean;
  pushed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  license: {
    key: string;
    name: string;
    spdx_id: string | null;
  } | null;
  owner: {
    login: string;
  };
}

interface GitHubContentResponse {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  content?: string;
  encoding?: string;
}

interface GitHubReleaseResponse {
  name: string | null;
  tag_name: string;
  published_at: string | null;
}

interface GitHubCommitResponse {
  sha: string;
}

export class GitHubApiError extends Error {
  status: number;
  rateLimitRemaining?: string | null;

  constructor(message: string, status: number, rateLimitRemaining?: string | null) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimitRemaining = rateLimitRemaining;
  }
}

export function parseGitHubRepo(input: string): ParsedRepo {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withoutProtocol = trimmed
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "");

  const parts = withoutProtocol.split("/").filter(Boolean);
  const [owner, repo] = parts;

  if (!owner || !repo || parts.length !== 2) {
    throw new Error("Enter a GitHub repo as owner/repo or a GitHub repository URL.");
  }

  const validSegment = /^[A-Za-z0-9_.-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo)) {
    throw new Error("Repo owner and name can only contain letters, numbers, dots, dashes, and underscores.");
  }

  return { owner, repo };
}

export async function fetchRepoSnapshot(input: ParsedRepo): Promise<RepoSnapshot> {
  const [repoResponse, readmeResponse, rootResponse, releasesResponse, commitsResponse, workflowsResponse, securityResponse] =
    await Promise.all([
      githubFetch<GitHubRepoResponse>(`/repos/${input.owner}/${input.repo}`),
      githubFetch<GitHubContentResponse>(`/repos/${input.owner}/${input.repo}/readme`, true),
      githubFetch<GitHubContentResponse[]>(`/repos/${input.owner}/${input.repo}/contents`, true),
      githubFetch<GitHubReleaseResponse[]>(`/repos/${input.owner}/${input.repo}/releases?per_page=10`, true),
      githubFetch<GitHubCommitResponse[]>(`/repos/${input.owner}/${input.repo}/commits?per_page=1`, true),
      githubFetch<GitHubContentResponse[]>(`/repos/${input.owner}/${input.repo}/contents/.github/workflows`, true),
      githubFetch<GitHubContentResponse>(`/repos/${input.owner}/${input.repo}/contents/SECURITY.md`, true)
    ]);

  const repo = repoResponse.data;
  if (!repo) {
    throw new GitHubApiError("Repository not found or not public.", 404, repoResponse.rateLimitRemaining);
  }

  const metadata: RepoMetadata = {
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    htmlUrl: repo.html_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    defaultBranch: repo.default_branch,
    language: repo.language,
    topics: repo.topics ?? [],
    archived: repo.archived,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    license: repo.license
      ? {
          key: repo.license.key,
          name: repo.license.name,
          spdxId: repo.license.spdx_id
        }
      : null
  };

  return {
    repo: metadata,
    readme: readmeResponse.data ? decodeGitHubContent(readmeResponse.data) : null,
    rootFiles: Array.isArray(rootResponse.data) ? rootResponse.data.map((item) => item.name) : [],
    workflowFiles: Array.isArray(workflowsResponse.data) ? workflowsResponse.data.map((item) => item.name) : [],
    releases: Array.isArray(releasesResponse.data)
      ? releasesResponse.data.map((release) => ({
          name: release.name,
          tagName: release.tag_name,
          publishedAt: release.published_at
        }))
      : [],
    latestCommitSha: Array.isArray(commitsResponse.data) ? commitsResponse.data[0]?.sha ?? null : null,
    securityPolicyPresent: Boolean(securityResponse.data),
    rateLimitRemaining: repoResponse.rateLimitRemaining
  };
}

async function githubFetch<T>(
  path: string,
  tolerateNotFound = false
): Promise<{ data: T | null; rateLimitRemaining?: string | null }> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "AdoptCheck-MVP",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com${path}`, {
    headers,
    next: { revalidate: 60 }
  });

  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");

  if (response.status === 404 && tolerateNotFound) {
    return { data: null, rateLimitRemaining };
  }

  if (!response.ok) {
    let message = `GitHub returned ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Keep the status-derived fallback.
    }
    throw new GitHubApiError(message, response.status, rateLimitRemaining);
  }

  return { data: (await response.json()) as T, rateLimitRemaining };
}

function decodeGitHubContent(file: GitHubContentResponse): string | null {
  if (!file.content || file.encoding !== "base64") {
    return null;
  }

  return Buffer.from(file.content, "base64").toString("utf8");
}
