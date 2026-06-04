import type { CategoryScore, Confidence, EvidenceItem, LLMAnalysis, RepoReport, RepoSnapshot, Verdict } from "./types";

const manifestFiles = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
  "deno.json"
];

const lockFiles = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "uv.lock",
  "poetry.lock",
  "Cargo.lock",
  "go.sum",
  "Gemfile.lock",
  "composer.lock"
];

const testHints = ["test", "tests", "__tests__", "spec", "jest.config", "vitest.config", "pytest.ini"];
const envHints = [".env.example", ".env.sample", "example.env", "config.example.json"];
const deployHints = ["Dockerfile", "docker-compose.yml", "vercel.json", "netlify.toml", "railway.json", "render.yaml"];

export function buildRepoReport(snapshot: RepoSnapshot): RepoReport {
  const observedAt = new Date().toISOString();
  const evidence: EvidenceItem[] = [];
  const rootSet = new Set(snapshot.rootFiles.map((file) => file.toLowerCase()));
  const readme = snapshot.readme ?? "";
  const readmeLower = readme.toLowerCase();

  const addEvidence = (
    id: string,
    type: EvidenceItem["type"],
    source: string,
    claim: string,
    confidence: Confidence = "high",
    url?: string
  ) => {
    evidence.push({ id, type, source, claim, confidence, observedAt, url });
    return id;
  };

  const repoEvidence = addEvidence(
    "ev_repo_metadata",
    "github_api",
    "GitHub repository API",
    `${snapshot.repo.fullName} has ${snapshot.repo.stars.toLocaleString()} stars, ${snapshot.repo.forks.toLocaleString()} forks, and ${snapshot.repo.openIssues.toLocaleString()} open issues.`,
    "high",
    snapshot.repo.htmlUrl
  );

  const pushedEvidence = addEvidence(
    "ev_maintenance_pushed",
    "github_api",
    "pushed_at",
    snapshot.repo.pushedAt
      ? `Latest pushed timestamp is ${new Date(snapshot.repo.pushedAt).toISOString().slice(0, 10)}.`
      : "GitHub did not return a latest pushed timestamp.",
    snapshot.repo.pushedAt ? "high" : "unknown"
  );

  const releaseEvidence = addEvidence(
    "ev_releases",
    "github_api",
    "releases",
    snapshot.releases.length
      ? `GitHub returned ${snapshot.releases.length} recent release records.`
      : "No recent releases were returned by the GitHub releases API.",
    "high"
  );

  const readmeEvidence = addEvidence(
    "ev_readme",
    "file",
    "README",
    snapshot.readme
      ? `README is present with ${readme.length.toLocaleString()} characters.`
      : "README was not found through the GitHub README endpoint.",
    snapshot.readme ? "high" : "high"
  );

  const manifestMatches = manifestFiles.filter((file) => rootSet.has(file.toLowerCase()));
  const lockMatches = lockFiles.filter((file) => rootSet.has(file.toLowerCase()));
  const manifestEvidence = addEvidence(
    "ev_manifests",
    "manifest",
    "Repository root",
    manifestMatches.length
      ? `Detected package manifests: ${manifestMatches.join(", ")}.`
      : "No common package manifest was detected at the repository root.",
    "high"
  );
  const lockEvidence = addEvidence(
    "ev_lockfiles",
    "manifest",
    "Repository root",
    lockMatches.length ? `Detected lockfiles: ${lockMatches.join(", ")}.` : "No common lockfile was detected at the repository root.",
    "high"
  );

  const installCommandFound = /(npm|pnpm|yarn|pip|poetry|uv|cargo|go|mvn|gradle|bundle)\s+(install|add|run|test|build|start|dev|sync)|docker compose|docker run/i.test(
    readme
  );
  const installEvidence = addEvidence(
    "ev_readme_install",
    "file",
    "README",
    installCommandFound
      ? "README appears to document setup, install, run, or build commands."
      : "README did not expose obvious setup, install, run, or build commands in this scan.",
    installCommandFound ? "medium" : "medium"
  );

  const licenseFilePresent = snapshot.rootFiles.some((file) => /^licen[cs]e/i.test(file));
  const licenseEvidence = addEvidence(
    "ev_license",
    "github_api",
    "license metadata",
    snapshot.repo.license
      ? `GitHub identifies the license as ${snapshot.repo.license.name} (${snapshot.repo.license.spdxId ?? snapshot.repo.license.key}).`
      : licenseFilePresent
        ? "A license-like file is present, but GitHub did not identify a standard license."
        : "No license metadata or license-like root file was found.",
    snapshot.repo.license || licenseFilePresent ? "high" : "high"
  );

  const workflowEvidence = addEvidence(
    "ev_ci",
    "file",
    ".github/workflows",
    snapshot.workflowFiles.length
      ? `Detected ${snapshot.workflowFiles.length} GitHub Actions workflow file(s).`
      : "No GitHub Actions workflow files were detected.",
    "high"
  );

  const testsPresent = snapshot.rootFiles.some((file) => testHints.some((hint) => file.toLowerCase().includes(hint)));
  const testsEvidence = addEvidence(
    "ev_tests",
    "file",
    "Repository root",
    testsPresent
      ? "Root-level files or folders suggest a test setup is present."
      : "No obvious root-level test files or folders were detected.",
    "medium"
  );

  const securityEvidence = addEvidence(
    "ev_security_policy",
    "security",
    "SECURITY.md",
    snapshot.securityPolicyPresent ? "SECURITY.md is present." : "SECURITY.md was not detected at the repository root.",
    "high"
  );

  const envEvidence = addEvidence(
    "ev_env_example",
    "file",
    "Repository root",
    snapshot.rootFiles.some((file) => envHints.includes(file))
      ? "Environment example file is present."
      : "No common environment example file was detected.",
    "medium"
  );

  const deployEvidence = addEvidence(
    "ev_deploy_docs",
    "file",
    "Repository root",
    snapshot.rootFiles.some((file) => deployHints.includes(file))
      ? "Deployment-oriented config or container files were detected."
      : "No common deployment config file was detected at the root.",
    "medium"
  );

  const readmeClaimsProduction = /\b(production|enterprise|secure|scalable|battle-tested|robust)\b/i.test(readme);
  const claimEvidence = addEvidence(
    "ev_doc_claims",
    "file",
    "README",
    readmeClaimsProduction
      ? "README makes production, security, scale, or robustness claims that should be checked against implementation evidence."
      : "README does not appear to make strong production, security, scale, or robustness claims.",
    "medium"
  );

  const marketEvidence = addEvidence(
    "ev_market_signal",
    "manual_note",
    "README, topics, and repo metadata",
    marketSignalClaim(snapshot, readmeLower),
    "medium"
  );

  const daysSincePush = snapshot.repo.pushedAt ? daysBetween(new Date(snapshot.repo.pushedAt), new Date(observedAt)) : null;
  const maintenanceScore = clamp(
    (snapshot.repo.archived ? 5 : recencyScore(daysSincePush)) +
      (snapshot.releases.length ? 10 : 0) +
      (snapshot.latestCommitSha ? 5 : 0) -
      (snapshot.repo.openIssues > 100 ? 8 : 0)
  );
  const installabilityScore = clamp(
    (manifestMatches.length ? 38 : 0) + (lockMatches.length ? 20 : 0) + (installCommandFound ? 32 : 0) + (readme ? 10 : 0)
  );
  const licenseScore = snapshot.repo.license ? 92 : licenseFilePresent ? 66 : 16;
  const documentationScore = clamp((readme ? 48 : 5) + (installCommandFound ? 18 : 0) + (readmeClaimsProduction ? (testsPresent || snapshot.workflowFiles.length ? 10 : -12) : 18));
  const dependencyScore = clamp(42 + (lockMatches.length ? 24 : -10) + (snapshot.securityPolicyPresent ? 14 : 0) + (manifestMatches.length <= 2 ? 10 : 0));
  const productionScore = clamp(
    (testsPresent ? 26 : 0) +
      (snapshot.workflowFiles.length ? 26 : 0) +
      (snapshot.rootFiles.some((file) => envHints.includes(file)) ? 14 : 0) +
      (snapshot.rootFiles.some((file) => deployHints.includes(file)) ? 16 : 0) +
      (snapshot.releases.length ? 10 : 0)
  );
  const marketScore = clamp(
    30 +
      Math.min(snapshot.repo.stars, 5000) / 100 +
      (snapshot.repo.description ? 12 : 0) +
      (snapshot.repo.topics.length ? 12 : 0) +
      (/(agent|ai|automation|workflow|developer|database|security|deploy|observability)/i.test(`${readme} ${snapshot.repo.topics.join(" ")}`) ? 14 : 0)
  );

  const scores: CategoryScore[] = [
    score("maintenance", "Maintenance", maintenanceScore, [pushedEvidence, releaseEvidence, repoEvidence]),
    score("installability", "Installability", installabilityScore, [manifestEvidence, lockEvidence, installEvidence]),
    score("documentation", "Documentation Honesty", documentationScore, [readmeEvidence, installEvidence, claimEvidence]),
    score("license", "License Clarity", licenseScore, [licenseEvidence]),
    score("dependencyRisk", "Dependency & Security Risk", dependencyScore, [manifestEvidence, lockEvidence, securityEvidence]),
    score("productionReadiness", "Production Readiness", productionScore, [testsEvidence, workflowEvidence, envEvidence, deployEvidence]),
    score("marketSignal", "Market / Usefulness Signal", marketScore, [marketEvidence, repoEvidence])
  ];

  const risks = buildRisks(snapshot, {
    daysSincePush,
    manifestMatches,
    lockMatches,
    installCommandFound,
    testsPresent,
    readmeClaimsProduction
  });
  const verdict = chooseVerdict(scores, snapshot, risks);
  const confidence = chooseConfidence(evidence, snapshot);
  const bottomLine = buildBottomLine(snapshot, verdict, scores, risks);
  const recommendedAction = buildRecommendedAction(verdict, scores, risks);
  const nullhypeAngle = buildNullhypeAngle(snapshot, verdict, marketScore);

  const reportWithoutMarkdown: Omit<RepoReport, "markdown"> = {
    repo: snapshot.repo,
    verdict,
    confidence,
    bottomLine,
    scores,
    risks,
    recommendedAction,
    nullhypeAngle,
    llmAnalysis: {
      status: "not_configured"
    },
    evidence,
    generatedAt: observedAt
  };

  return {
    ...reportWithoutMarkdown,
    markdown: renderMarkdown(reportWithoutMarkdown)
  };
}

export function attachLLMAnalysis(report: RepoReport, analysis: LLMAnalysis): RepoReport {
  const evidence = analysis.status === "generated" ? [...report.evidence, llmEvidence(report, analysis)] : report.evidence;
  const enriched = {
    ...report,
    llmAnalysis: analysis,
    evidence
  };

  return {
    ...enriched,
    markdown: renderMarkdown(enriched)
  };
}

function score(category: CategoryScore["category"], name: string, value: number, evidenceIds: string[]): CategoryScore {
  return {
    category,
    name,
    score: Math.round(clamp(value)),
    label: labelFor(value),
    evidenceIds
  };
}

function buildRisks(
  snapshot: RepoSnapshot,
  facts: {
    daysSincePush: number | null;
    manifestMatches: string[];
    lockMatches: string[];
    installCommandFound: boolean;
    testsPresent: boolean;
    readmeClaimsProduction: boolean;
  }
): string[] {
  const risks: string[] = [];

  if (snapshot.repo.archived) {
    risks.push("Repository is archived, so adoption should assume no active maintenance.");
  }
  if (facts.daysSincePush === null || facts.daysSincePush > 365) {
    risks.push("Maintenance recency is weak or unknown.");
  }
  if (!snapshot.repo.license && !snapshot.rootFiles.some((file) => /^licen[cs]e/i.test(file))) {
    risks.push("License clarity is missing, which blocks confident adoption.");
  }
  if (!facts.manifestMatches.length) {
    risks.push("No common package manifest was detected at the root.");
  }
  if (facts.manifestMatches.length && !facts.lockMatches.length) {
    risks.push("Manifest exists without a detected lockfile, so dependency reproducibility needs review.");
  }
  if (!facts.installCommandFound) {
    risks.push("README setup path was not obvious in this scan.");
  }
  if (facts.readmeClaimsProduction && !facts.testsPresent && !snapshot.workflowFiles.length) {
    risks.push("README makes strong readiness claims without obvious test or CI evidence.");
  }
  if (!snapshot.securityPolicyPresent) {
    risks.push("No SECURITY.md was detected.");
  }

  return risks.slice(0, 6);
}

function chooseVerdict(scores: CategoryScore[], snapshot: RepoSnapshot, risks: string[]): Verdict {
  const average = scores.reduce((sum, item) => sum + item.score, 0) / scores.length;
  const byCategory = Object.fromEntries(scores.map((item) => [item.category, item.score])) as Record<CategoryScore["category"], number>;

  if (snapshot.repo.archived || byCategory.license < 25 || average < 42) {
    return "Avoid";
  }
  if (average >= 74 && byCategory.maintenance >= 68 && byCategory.installability >= 68 && byCategory.license >= 70) {
    return "Use";
  }
  if (byCategory.marketSignal >= 62 && risks.length <= 5 && (byCategory.productionReadiness < 60 || byCategory.installability < 64)) {
    return "Fork";
  }
  return "Watch";
}

function chooseConfidence(evidence: EvidenceItem[], snapshot: RepoSnapshot): Confidence {
  const directEvidence = evidence.filter((item) => item.confidence === "high").length;
  if (directEvidence >= 8 && snapshot.readme && snapshot.rootFiles.length > 0) {
    return "high";
  }
  if (directEvidence >= 5) {
    return "medium";
  }
  return "low";
}

function buildBottomLine(snapshot: RepoSnapshot, verdict: Verdict, scores: CategoryScore[], risks: string[]) {
  const strongest = [...scores].sort((a, b) => b.score - a.score)[0];
  const weakest = [...scores].sort((a, b) => a.score - b.score)[0];
  const riskLine = risks[0] ?? "No major blocker appeared in the deterministic scan.";

  return `${snapshot.repo.fullName} receives a ${verdict} verdict from this evidence-backed scan. The strongest signal is ${strongest.name.toLowerCase()} (${strongest.label}), while the biggest adoption constraint is ${weakest.name.toLowerCase()} (${weakest.label}). ${riskLine}`;
}

function buildRecommendedAction(verdict: Verdict, scores: CategoryScore[], risks: string[]) {
  const weak = [...scores].sort((a, b) => a.score - b.score)[0];

  if (verdict === "Use") {
    return "Use it for a real evaluation, but still run install/build/tests locally before wiring it into production.";
  }
  if (verdict === "Fork") {
    return `Fork or prototype around the repo, then close the ${weak.name.toLowerCase()} gap before depending on it.`;
  }
  if (verdict === "Avoid") {
    return `Avoid adoption until the maintainer resolves the top blocker: ${risks[0] ?? weak.name}.`;
  }
  return `Watch it and re-scan after evidence improves around ${weak.name.toLowerCase()}.`;
}

function buildNullhypeAngle(snapshot: RepoSnapshot, verdict: Verdict, marketScore: number) {
  const topic = snapshot.repo.topics[0] ?? snapshot.repo.language ?? "developer workflow";
  if (marketScore >= 70) {
    return `${snapshot.repo.fullName} is worth tracking as a ${topic} wedge: attention is less important than whether the repo can survive adoption due diligence.`;
  }
  if (verdict === "Avoid") {
    return `${snapshot.repo.fullName} is a clean example of why stars and README polish should not be treated as adoption trust.`;
  }
  return `${snapshot.repo.fullName} may be useful for discovery, but the adoption story depends on stronger installability, maintenance, and readiness evidence.`;
}

function marketSignalClaim(snapshot: RepoSnapshot, readmeLower: string) {
  const keywords = ["agent", "ai", "automation", "workflow", "developer", "security", "observability", "database", "deploy"];
  const matched = keywords.filter((keyword) => readmeLower.includes(keyword) || snapshot.repo.topics.includes(keyword));

  if (matched.length) {
    return `Repo signals a ${matched.slice(0, 3).join(", ")} workflow or infrastructure wedge.`;
  }
  if (snapshot.repo.description) {
    return `Repo description gives a usable first-pass product/usefulness signal: "${snapshot.repo.description.slice(0, 140)}".`;
  }
  return "Market/usefulness signal is weak because description, topics, and README keywords are limited.";
}

function renderMarkdown(report: Omit<RepoReport, "markdown">) {
  const scoreLines = report.scores.map((item) => `- ${item.name}: ${item.label} (${item.score}/100)`).join("\n");
  const riskLines = report.risks.length ? report.risks.map((risk) => `- ${risk}`).join("\n") : "- No major blocker appeared in the deterministic scan.";
  const llmSection = renderLLMMarkdown(report.llmAnalysis);
  const evidenceRows = report.evidence
    .map((item) => `| ${item.id} | ${item.type} | ${item.source} | ${item.claim.replace(/\|/g, "\\|")} | ${item.confidence} |`)
    .join("\n");

  return `# Repo Due Diligence: ${report.repo.fullName}

Verdict: ${report.verdict}
Confidence: ${capitalize(report.confidence)}
Generated: ${report.generatedAt}

## Bottom Line
${report.bottomLine}

## Scores
${scoreLines}

## Risks
${riskLines}

## Recommended Action
${report.recommendedAction}

## Nullhype Angle
${report.nullhypeAngle}

${llmSection}

## Evidence
| ID | Type | Source | Observation | Confidence |
| --- | --- | --- | --- | --- |
${evidenceRows}
`;
}

function llmEvidence(report: RepoReport, analysis: LLMAnalysis): EvidenceItem {
  return {
    id: "ev_llm_analysis",
    type: "llm_inference",
    source: analysis.model ?? "OpenAI Responses API",
    claim: `Generated evidence-grounded analyst interpretation for ${report.repo.fullName}; cited evidence IDs: ${(analysis.evidenceIds ?? []).join(", ") || "none returned"}.`,
    confidence: "medium",
    observedAt: analysis.generatedAt ?? new Date().toISOString()
  };
}

function renderLLMMarkdown(analysis: LLMAnalysis) {
  if (analysis.status === "not_configured") {
    return "## AI Analyst\nNot configured. Set `OPENAI_API_KEY` to add evidence-grounded LLM interpretation.";
  }
  if (analysis.status === "failed") {
    return `## AI Analyst\nLLM analysis failed, so this report falls back to deterministic scoring. Error: ${analysis.error ?? "Unknown error"}`;
  }

  const riskLines = analysis.adoptionRisks?.length ? analysis.adoptionRisks.map((risk) => `- ${risk}`).join("\n") : "- No additional LLM risks returned.";
  const evidenceLine = analysis.evidenceIds?.length ? `\n\nEvidence cited: ${analysis.evidenceIds.map((id) => `\`${id}\``).join(", ")}` : "";

  return `## AI Analyst
${analysis.summary ?? "No summary returned."}

### README Honesty
${analysis.readmeHonesty ?? "No README honesty analysis returned."}

### Adoption Risks
${riskLines}

### Next Action
${analysis.nextAction ?? "No next action returned."}

### Market / Nullhype Angle
${analysis.nullhypeAngle ?? "No market angle returned."}${evidenceLine}`;
}

function recencyScore(days: number | null) {
  if (days === null) return 15;
  if (days <= 30) return 82;
  if (days <= 90) return 72;
  if (days <= 180) return 58;
  if (days <= 365) return 42;
  if (days <= 730) return 24;
  return 12;
}

function labelFor(scoreValue: number): CategoryScore["label"] {
  if (scoreValue >= 78) return "Strong";
  if (scoreValue >= 64) return "Good";
  if (scoreValue >= 45) return "Mixed";
  if (scoreValue >= 20) return "Risky";
  return "Unknown";
}

function daysBetween(older: Date, newer: Date) {
  return Math.floor((newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
