# AdoptCheck

Open-source repo due diligence before you install, fork, or ship.

AdoptCheck is a deterministic-first scanner for public GitHub repositories. Paste a repo URL or `owner/repo` and get an evidence-backed verdict: `Use`, `Fork`, `Watch`, or `Avoid`.

## MVP Scope

- Public GitHub repositories only
- GitHub API metadata, README, root files, releases, CI, license, and security policy checks
- Evidence ledger with IDs, sources, confidence, and observations
- JSON and Markdown report output
- Optional evidence-grounded LLM analyst when `OPENAI_API_KEY` is configured
- No private repo support, database persistence, cloning, installs, builds, or arbitrary repo execution

## Local Development

```bash
npm install
npm run dev
```

Optional:

```bash
GITHUB_TOKEN=ghp_xxx npm run dev
OPENAI_API_KEY=sk_xxx npm run dev
```

`GITHUB_TOKEN` increases GitHub API rate limits. `OPENAI_API_KEY` enables the optional analyst layer. Secrets are never rendered in reports.

## Checks

```bash
npm test
npm run lint
npm run build
```
