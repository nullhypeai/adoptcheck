export type Verdict = "Use" | "Fork" | "Watch" | "Avoid";

export type Confidence = "high" | "medium" | "low" | "unknown";

export type EvidenceType =
  | "github_api"
  | "file"
  | "manifest"
  | "security"
  | "llm_inference"
  | "manual_note";

export type ScoreCategory =
  | "maintenance"
  | "installability"
  | "documentation"
  | "license"
  | "dependencyRisk"
  | "productionReadiness"
  | "marketSignal";

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  source: string;
  claim: string;
  confidence: Confidence;
  observedAt: string;
  url?: string;
}

export interface CategoryScore {
  category: ScoreCategory;
  name: string;
  score: number;
  label: "Strong" | "Good" | "Mixed" | "Risky" | "Unknown";
  evidenceIds: string[];
}

export interface RepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  language: string | null;
  topics: string[];
  archived: boolean;
  pushedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  license: {
    key: string;
    name: string;
    spdxId: string | null;
  } | null;
}

export interface RepoReport {
  repo: RepoMetadata;
  verdict: Verdict;
  confidence: Confidence;
  bottomLine: string;
  scores: CategoryScore[];
  risks: string[];
  recommendedAction: string;
  nullhypeAngle: string;
  evidence: EvidenceItem[];
  markdown: string;
  generatedAt: string;
}

export interface RepoSnapshot {
  repo: RepoMetadata;
  readme: string | null;
  rootFiles: string[];
  workflowFiles: string[];
  releases: Array<{ name: string | null; tagName: string; publishedAt: string | null }>;
  latestCommitSha: string | null;
  securityPolicyPresent: boolean;
  rateLimitRemaining?: string | null;
}
