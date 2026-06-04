import type { LLMAnalysis, RepoReport } from "./types";

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

const defaultModel = "gpt-4o-mini";

export async function generateLLMAnalysis(report: RepoReport): Promise<LLMAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "not_configured" };
  }

  const model = process.env.OPENAI_MODEL || defaultModel;
  const generatedAt = new Date().toISOString();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions:
          "You are the optional AdoptCheck analyst layer. The deterministic scanner is the source of truth. Do not change the verdict, confidence, scores, or risks. Interpret only the provided structured report. Every substantive claim must be grounded in the supplied evidence IDs. Keep the language concise, practical, and adoption-focused.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(buildLLMPayload(report))
              }
            ]
          }
        ],
        max_output_tokens: 900,
        text: {
          format: {
            type: "json_schema",
            name: "adoptcheck_llm_analysis",
            strict: true,
            schema: analysisSchema
          }
        }
      })
    });

    const body = (await response.json()) as OpenAIResponse;
    if (!response.ok) {
      return {
        status: "failed",
        model,
        generatedAt,
        error: body.error?.message ?? `OpenAI returned ${response.status}`
      };
    }

    const parsed = parseAnalysis(extractOutputText(body));
    return {
      status: "generated",
      model,
      generatedAt,
      ...parsed,
      evidenceIds: filterEvidenceIds(parsed.evidenceIds, report)
    };
  } catch (error) {
    return {
      status: "failed",
      model,
      generatedAt,
      error: error instanceof Error ? error.message : "Unknown LLM analysis error"
    };
  }
}

function buildLLMPayload(report: RepoReport) {
  return {
    repo: {
      fullName: report.repo.fullName,
      description: report.repo.description,
      language: report.repo.language,
      topics: report.repo.topics,
      stars: report.repo.stars,
      forks: report.repo.forks,
      openIssues: report.repo.openIssues,
      archived: report.repo.archived,
      pushedAt: report.repo.pushedAt,
      license: report.repo.license?.name ?? null
    },
    deterministicVerdict: report.verdict,
    confidence: report.confidence,
    deterministicBottomLine: report.bottomLine,
    deterministicRecommendedAction: report.recommendedAction,
    deterministicNullhypeAngle: report.nullhypeAngle,
    scores: report.scores.map((score) => ({
      category: score.category,
      name: score.name,
      score: score.score,
      label: score.label,
      evidenceIds: score.evidenceIds
    })),
    risks: report.risks,
    evidence: report.evidence.map((item) => ({
      id: item.id,
      type: item.type,
      source: item.source,
      claim: item.claim,
      confidence: item.confidence
    }))
  };
}

function extractOutputText(body: OpenAIResponse) {
  if (body.output_text) {
    return body.output_text;
  }

  const text = body.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" || content.text)
    .map((content) => content.text ?? "")
    .join("");

  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return text;
}

function parseAnalysis(text: string): Omit<LLMAnalysis, "status" | "model" | "generatedAt" | "error"> {
  const parsed = JSON.parse(text) as Omit<LLMAnalysis, "status" | "model" | "generatedAt" | "error">;

  return {
    summary: limitText(parsed.summary, 700),
    readmeHonesty: limitText(parsed.readmeHonesty, 520),
    adoptionRisks: (parsed.adoptionRisks ?? []).slice(0, 4).map((risk) => limitRequiredText(risk, 240)),
    nextAction: limitText(parsed.nextAction, 360),
    nullhypeAngle: limitText(parsed.nullhypeAngle, 420),
    evidenceIds: parsed.evidenceIds ?? []
  };
}

function filterEvidenceIds(ids: string[] | undefined, report: RepoReport) {
  const valid = new Set(report.evidence.map((item) => item.id));
  return [...new Set((ids ?? []).filter((id) => valid.has(id)))].slice(0, 10);
}

function limitText(value: string | undefined, maxLength: number) {
  if (!value) {
    return undefined;
  }

  return limitRequiredText(value, maxLength);
}

function limitRequiredText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "A concise bottom-line interpretation grounded in evidence IDs. Do not override the deterministic verdict."
    },
    readmeHonesty: {
      type: "string",
      description: "Whether README claims appear supported, weak, or incomplete based only on supplied evidence."
    },
    adoptionRisks: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "string"
      }
    },
    nextAction: {
      type: "string",
      description: "The practical next step for a builder considering adoption."
    },
    nullhypeAngle: {
      type: "string",
      description: "A market or workflow implication in a calm Nullhype-style voice."
    },
    evidenceIds: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "string"
      }
    }
  },
  required: ["summary", "readmeHonesty", "adoptionRisks", "nextAction", "nullhypeAngle", "evidenceIds"]
};
