import { NextResponse } from "next/server";
import { GitHubApiError, fetchRepoSnapshot, parseGitHubRepo, repoInputSchema } from "@/lib/github";
import { generateLLMAnalysis } from "@/lib/llm";
import { attachLLMAnalysis, buildRepoReport } from "@/lib/report";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = repoInputSchema.parse(await request.json());
    const parsed = parseGitHubRepo(body.repo);
    const snapshot = await fetchRepoSnapshot(parsed);
    const deterministicReport = buildRepoReport(snapshot);
    const analysis = await generateLLMAnalysis(deterministicReport);
    const report = attachLLMAnalysis(deterministicReport, analysis);

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        {
          error: error.status === 404 ? "Repository not found or not public." : error.message,
          status: error.status,
          rateLimitRemaining: error.rateLimitRemaining
        },
        { status: error.status === 403 ? 429 : error.status }
      );
    }

    const message = error instanceof Error ? error.message : "Unable to scan repository.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
