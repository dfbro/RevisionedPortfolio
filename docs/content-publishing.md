# Production content publishing

The production repository is the public source of truth. The local editor is the preferred UI, but direct file edits are supported when reviewed carefully.

## Content locations

| Content | File |
| --- | --- |
| Site origin/title/language | `content/site.json` |
| Profile/contact/skills/education/SEO | `content/profile.json` |
| Theme/fonts/colors | `content/appearance.json` |
| Projects | `content/projects.json` |
| Achievements | `content/achievements.json` |
| Articles | `content/writeups/<slug>.md` |
| Public images/documents | `public/assets/uploads/` |

The exact schema is described in [template content contract](../../RevisionedPortfolioTemplate/docs/content-contract.md).

## Article format and status

Each Markdown article has frontmatter followed by the body:

```yaml
---
slug: "example-article"
title: "Example article"
competition: "Example CTF"
category: "Pwn"
difficulty: "Medium"
date: "2026-11-11"
updated: null
summary: "Short public description."
tags: ["example", "technique"]
status: "draft"
flag: null
attachments: []
---
```

Values in frontmatter are parsed as JSON literals. Use double quotes for strings, JSON arrays for tags/attachments, `null` for missing values, and `true/false` for booleans. Filename must be exactly `<slug>.md`; slug must be lowercase kebab-case.

Use `draft` to keep an article out of public static route generation and sitemap. Use `published` to publish it on the next successful build. Keep at least one article published because Next.js static export requires a parameter for the dynamic article and article-image routes.

## Asset rules

Reference local public assets with paths such as `/assets/uploads/example.png`. The editor stores uploaded files under `public/assets/uploads/`. Ensure that Markdown body images, profile/project/achievement images and attachment URLs resolve to real files under `public/`.

Everything in `public/` and every published article is public. Never store private credentials, private messages, session data or files that should not be downloadable.

## Validate direct changes

```sh
pnpm verify:content
pnpm check
pnpm verify:output
pnpm e2e
git diff --check
```

`pnpm build` refreshes generated output. `pnpm verify:output` checks expected routes, sitemap, upload parity and the absence of server/database-only source paths.

Commit/push changes only after reviewing the diff. See [GitHub Pages deployment](github-pages.md).
