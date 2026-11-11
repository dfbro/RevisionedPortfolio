# Claritys — Elang Dimas Syadewa

Personal static site for Elang Dimas Syadewa (**Claritys**): pwn-focused CTF writeups, projects, achievements, and technical profile. Public content is stored as files in this repository and rendered during the build. The local CMS lives in the sibling `RevisionedPortfolioEditor` repository.

## Stack

Next.js 16 static export (App Router) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · GSAP (ScrollTrigger, SplitText, ScrambleText) + Lenis · Markdown/JSON content · Shiki · Vitest · Playwright

## Local development

```bash
pnpm install
pnpm dev                         # Next.js development preview at http://localhost:3007
pnpm build                       # generates static output in out/
pnpm start                       # serves out/ at http://127.0.0.1:3100
```

The public site has no database, login, upload endpoint, contact API, or request-time Next.js server. `pnpm start` is a small static file server for local preview; production hosting receives only the contents of `out/`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js development server on port 3007 |
| `pnpm start` / `pnpm preview:static` | Serves the built `out/` directory on loopback port 3100 |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm e2e` | Playwright tests against the exported files served without Next.js runtime |
| `pnpm typecheck` / `pnpm lint` | Type and lint checks |
| `pnpm check` | lint + typecheck + unit tests + build |
| `pnpm verify:content` | Validates content schemas, slugs and asset references |
| `pnpm verify:output` | Checks generated routes, sitemap, assets and absence of server/database files |

## Deploy

The `.github/workflows/pages.yml` workflow keeps lint, typecheck, unit tests, content validation, static build and output verification in the source repository. It uploads `out/` as a generic workflow artifact, then publishes that artifact to the separate `dfbro/RevisionedPortfolioSite` repository. The target repository contains only the generated site and publishes `main` → `/(root)` through GitHub Pages branch publishing.

### Domain and route configuration

`content/site.json` is the source for the canonical site origin, trailing-slash policy, title, description, and language. The build derives canonical metadata, Open Graph URLs, JSON-LD, sitemap, and robots output from this configuration. Changing the URL in this file does not change DNS or GitHub Pages settings; those must be configured separately.

GitHub Pages serves the static deployment repository at [https://dfbro.github.io/RevisionedPortfolioSite/](https://dfbro.github.io/RevisionedPortfolioSite/). The build derives Next.js `basePath` and canonical URLs from the `STATIC_SITE_REPOSITORY` Actions variable. The source repository no longer hosts Pages directly and has no Pages-specific Actions permissions. No custom domain is configured.

### Editing content

Run the sibling local editor from `../RevisionedPortfolioEditor`. It reads and writes this source repository's `content/` and `public/assets/` directly. There is no second content database. Save changes locally, review the Git diff, then explicitly commit and push. GitHub Actions builds here and pushes only generated files to the separate static repository.

### Data migration archive

The old PostgreSQL/Prisma runtime and deployment files have been removed from this public repository. A read-only copy of the old runtime configuration and migration report is retained under the workspace-level `legacy-archive/`; it is not part of this repository or the static output. Do not publish SQL dumps, credentials, private contact messages, access logs, or unreviewed fields from the old system.

## Documentation

- [GitHub Pages deployment and troubleshooting](docs/github-pages.md)
- [Production content and publishing](docs/content-publishing.md)
- [Workspace operating guide](../docs/WORKSPACE-GUIDE.md)

## Design rules

The site is editorial first. Large Archivo type, one accent (`#FF5B1F`), mono only for metadata. The security identity shows up in exactly five places and nowhere else:

1. The hero role line decrypts once.
2. Section indexes are hex (`0x01 / about`).
3. Writeup flags have a visual reveal control; the value is still included in public static output.
4. The nav shows scroll progress as `0x0000 → 0xFFFF`.
5. The footer's giant `ELANG` occasionally glitches into `CLARITYS`. Its timing lives in `src/lib/glitch.ts`.

Every animation is disabled or reduced under `prefers-reduced-motion`, and the article/page content is rendered into HTML at build time rather than requiring a client-side data fetch.

**Flag visibility note:** the reveal mask is presentation only. Published flags are included in the static page payload, the public MDX files, and the Markdown/HTML exports. Do not store operational secrets in this field.
