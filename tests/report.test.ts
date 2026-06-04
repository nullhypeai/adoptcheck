import { describe, expect, it } from "vitest";
import { attachLLMAnalysis, buildRepoReport } from "@/lib/report";
import { fixtureSnapshot } from "./fixtures";

describe("buildRepoReport", () => {
  it("returns a use verdict for a healthy fixture", () => {
    const report = buildRepoReport(fixtureSnapshot());

    expect(report.verdict).toBe("Use");
    expect(report.llmAnalysis.status).toBe("not_configured");
    expect(report.evidence.length).toBeGreaterThanOrEqual(10);
    expect(report.markdown).toContain("# Repo Due Diligence: example/healthy");
    expect(report.markdown).toContain("## AI Analyst");
  });

  it("returns avoid for archived repositories", () => {
    const report = buildRepoReport(
      fixtureSnapshot({
        repo: {
          archived: true,
          pushedAt: "2020-01-01T00:00:00Z",
          license: null
        },
        releases: [],
        securityPolicyPresent: false
      })
    );

    expect(report.verdict).toBe("Avoid");
    expect(report.risks.some((risk) => risk.includes("archived"))).toBe(true);
  });

  it("flags missing install evidence", () => {
    const report = buildRepoReport(
      fixtureSnapshot({
        readme: "A small library.",
        rootFiles: ["README.md", "LICENSE"]
      })
    );

    expect(report.risks).toContain("No common package manifest was detected at the root.");
    expect(report.risks).toContain("README setup path was not obvious in this scan.");
  });

  it("attaches generated LLM analysis without changing the deterministic verdict", () => {
    const report = buildRepoReport(fixtureSnapshot());
    const enriched = attachLLMAnalysis(report, {
      status: "generated",
      model: "test-model",
      generatedAt: "2026-06-04T00:00:00.000Z",
      summary: "The deterministic Use verdict is supported by installability and license evidence.",
      readmeHonesty: "README claims are mostly supported by setup and test evidence.",
      adoptionRisks: ["Run tests locally before production use."],
      nextAction: "Run install and test commands locally.",
      nullhypeAngle: "This repo shows why adoption evidence beats stars alone.",
      evidenceIds: ["ev_manifests", "ev_license"]
    });

    expect(enriched.verdict).toBe(report.verdict);
    expect(enriched.llmAnalysis.status).toBe("generated");
    expect(enriched.evidence.some((item) => item.id === "ev_llm_analysis")).toBe(true);
    expect(enriched.markdown).toContain("Evidence cited: `ev_manifests`, `ev_license`");
  });
});
