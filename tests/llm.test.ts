import { afterEach, describe, expect, it, vi } from "vitest";
import { generateLLMAnalysis } from "@/lib/llm";
import { buildRepoReport } from "@/lib/report";
import { fixtureSnapshot } from "./fixtures";

const originalEnv = process.env;

describe("generateLLMAnalysis", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it("returns not_configured without an OpenAI API key", async () => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;

    const analysis = await generateLLMAnalysis(buildRepoReport(fixtureSnapshot()));

    expect(analysis.status).toBe("not_configured");
  });

  it("returns structured generated analysis from OpenAI output text", async () => {
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key", OPENAI_MODEL: "test-model" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              summary: "Use verdict is supported by recent maintenance and installability evidence.",
              readmeHonesty: "README claims are supported by install and test signals.",
              adoptionRisks: ["Verify test commands locally.", "Review security policy before production use."],
              nextAction: "Run install and tests locally before adopting.",
              nullhypeAngle: "This is a workflow wedge where adoption trust matters more than stars.",
              evidenceIds: ["ev_maintenance_pushed", "ev_manifests", "ev_tests", "not_real"]
            })
          }),
          { status: 200 }
        );
      })
    );

    const analysis = await generateLLMAnalysis(buildRepoReport(fixtureSnapshot()));

    expect(analysis.status).toBe("generated");
    expect(analysis.model).toBe("test-model");
    expect(analysis.evidenceIds).toEqual(["ev_maintenance_pushed", "ev_manifests", "ev_tests"]);
  });

  it("falls back cleanly when OpenAI returns an error", async () => {
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: "Nope" } }), { status: 429 });
      })
    );

    const analysis = await generateLLMAnalysis(buildRepoReport(fixtureSnapshot()));

    expect(analysis.status).toBe("failed");
    expect(analysis.error).toBe("Nope");
  });
});
