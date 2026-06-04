import { describe, expect, it } from "vitest";
import { buildRepoReport } from "@/lib/report";
import { fixtureSnapshot } from "./fixtures";

describe("buildRepoReport", () => {
  it("returns a use verdict for a healthy fixture", () => {
    const report = buildRepoReport(fixtureSnapshot());

    expect(report.verdict).toBe("Use");
    expect(report.evidence.length).toBeGreaterThanOrEqual(10);
    expect(report.markdown).toContain("# Repo Due Diligence: example/healthy");
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
});
