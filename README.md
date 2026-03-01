# Claude AI Daily Brief

A automatically generated morning intelligence report covering Claude AI news, Anthropic announcements, developer updates, and community buzz — published daily at 8am.

🌐 **Live site:** [dmanock.github.io/claude-ai-brief](https://dmanock.github.io/claude-ai-brief)

---

## What's in each report

Every morning the brief covers:

- **Top Headlines** — the 2-3 most important Claude/Anthropic stories from the last 24 hours
- **Official Updates** — announcements directly from Anthropic's channels
- **Tips & Tricks** — prompting techniques and workflow ideas shared by the community
- **Developer News** — API changes, SDK updates, MCP ecosystem, and integrations
- **Community Buzz** — trending discussions, viral use cases, and notable threads

Each report also includes a ready-to-post **X (Twitter) thread** summarising the day's top stories.

---

## How it works

1. A scheduled Claude AI task runs at **8:00am** each morning, searches the web for the past 24 hours of Claude/Anthropic news, and generates an HTML report and X thread saved to a local folder
2. A Windows Task Scheduler job runs at **8:05am**, copies the new report into this repo and pushes to GitHub
3. GitHub Pages serves the updated site automatically

---

## Repo structure

```
/
├── index.html          # Home page — lists latest report and full archive
├── .nojekyll           # Tells GitHub Pages to serve static HTML directly
└── reports/
    └── claude-ai-daily-YYYY-MM-DD.html   # One file per day
```

---

## Powered by

- [Claude AI](https://claude.ai) — report generation and research
- [GitHub Pages](https://pages.github.com) — free static site hosting
- Windows Task Scheduler — automated daily push

---

*Not affiliated with Anthropic. This is an independent project.*
