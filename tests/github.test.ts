import { describe, expect, it } from "vitest";
import { parseGitHubRepo } from "@/lib/github";

describe("parseGitHubRepo", () => {
  it("parses owner/repo input", () => {
    expect(parseGitHubRepo("vercel/next.js")).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("parses GitHub URLs", () => {
    expect(parseGitHubRepo("https://github.com/modelcontextprotocol/typescript-sdk/")).toEqual({
      owner: "modelcontextprotocol",
      repo: "typescript-sdk"
    });
  });

  it("parses SSH clone URLs", () => {
    expect(parseGitHubRepo("git@github.com:owner/repo.git")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("rejects ambiguous paths", () => {
    expect(() => parseGitHubRepo("github.com/owner/repo/issues")).toThrow(/owner\/repo/);
  });
});
