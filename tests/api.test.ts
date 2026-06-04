import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scan/route";

describe("POST /api/scan", () => {
  it("rejects invalid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/scan", {
        method: "POST",
        body: JSON.stringify({ repo: "not a repo" })
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/owner\/repo/);
  });

  it("returns 404-shaped errors from GitHub", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "x-ratelimit-remaining": "42" }
        });
      })
    );

    const response = await POST(
      new Request("http://localhost/api/scan", {
        method: "POST",
        body: JSON.stringify({ repo: "missing/repo" })
      })
    );
    const body = (await response.json()) as { error: string; rateLimitRemaining: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Repository not found or not public.");
    expect(body.rateLimitRemaining).toBe("42");
    vi.unstubAllGlobals();
  });
});
