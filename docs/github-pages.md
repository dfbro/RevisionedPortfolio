# Source-to-static GitHub Pages publishing

## Repository boundaries

The publishing pipeline uses two different repositories with separate responsibilities:

| Repository | Visibility | Contents |
| --- | --- | --- |
| `dfbro/RevisionedPortfolio` | Public | Next.js source, content, assets, tests, CI and the build/publish workflow |
| `dfbro/RevisionedPortfolioSite` | Public | Generated static export only; `index.html` lives at repository root |

The editor and template remain independent repositories. The editor writes content/assets to the source repository only; it never writes to the static deployment repository.

The published project-site URL is:

`https://dfbro.github.io/RevisionedPortfolioSite/`

The URL's project prefix is derived from `STATIC_SITE_REPOSITORY`. A rename of the target repository therefore changes the prefix and must be reflected by the workflow variable before the next build.

## Build and publication flow

A push to `main` starts the source workflow. Manual dispatch can run the build from another ref for validation, but the publish job has an explicit `refs/heads/main` condition.

1. The build job checks out source and installs pnpm 11.4.0 and Node.js 24.
2. It installs the frozen lockfile and runs lint, typecheck, unit tests, content validation, static build and output verification.
3. It reports the output size, file count, largest files and required paths. A configurable size ceiling fails the build before publication.
4. `actions/upload-artifact@v4` stores the contents of `out/` as the generic `static-site` artifact.
5. The dependent publish job runs only for `main`, downloads that artifact and checks out the target repository in a separate `static-site/` directory.
6. `rsync --delete` synchronizes the contents of `out/` into the target repository root. It does not copy the `out` directory itself; it excludes `.git`, `CNAME` and `.nojekyll` from deletion/copy so those target-side files are preserved.
7. The job ensures `.nojekyll` exists, checks for root `index.html` and Next.js assets, inspects Git status, and skips the commit/push when the output is unchanged.
8. Changed output is committed as a normal fast-forward commit and pushed to the configured target branch. There is no force-push or history rewrite.
9. GitHub Pages publishes the target repository's `main` branch root.

The build and publish jobs use generic workflow artifacts, not `upload-pages-artifact` or `deploy-pages`. The target repository needs no custom Pages workflow of its own.

## Required source-repository variables and secret

Set these in **dfbro/RevisionedPortfolio → Settings → Secrets and variables → Actions**.

| Name | Kind | Value |
| --- | --- | --- |
| `STATIC_SITE_REPOSITORY` | Variable | `dfbro/RevisionedPortfolioSite` |
| `STATIC_SITE_BRANCH` | Variable | `main` |
| `STATIC_SITE_MAX_SIZE_MB` | Variable | `900` (optional; default is 900 MiB) |
| `STATIC_SITE_DEPLOY_TOKEN` | Secret | Fine-grained PAT or GitHub App installation token described below |

Create a fine-grained Personal Access Token with resource owner `dfbro`, repository access limited to **only** `RevisionedPortfolioSite`, and repository permission **Contents: Read and write**. No Pages permission is needed for the token because it only pushes files; GitHub Pages is already configured in the target repository. Set a reasonable expiry and rotate the credential before expiry.

Store the token only as the source repository secret `STATIC_SITE_DEPLOY_TOKEN`. Do not put it in a file, command argument, workflow YAML, commit, Actions variable or log. Do not use the source repository's `GITHUB_TOKEN` for the cross-repository push: GitHub documents that commits made with `GITHUB_TOKEN` do not trigger a GitHub Pages branch-source build.

One safe CLI method for adding the secret is to run this from an authenticated terminal; the command prompts for the secret value without placing it in shell history:

```sh
gh secret set STATIC_SITE_DEPLOY_TOKEN --repo dfbro/RevisionedPortfolio
```

The Actions job uses the credential only in the target checkout/push step. Its source-repository `GITHUB_TOKEN` remains read-only (`contents: read`); Pages-specific `pages: write` and `id-token: write` permissions have been removed.

## One-time target repository setup

The target repository is already created as public and its first static export has been pushed. Verify its settings:

1. Open **dfbro/RevisionedPortfolioSite → Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and folder to `/(root)`, then Save.
4. Keep the custom domain empty. There is no `CNAME` in the initial export.
5. Confirm `.nojekyll` exists at the repository root. The publisher re-creates it on every changed publication to prevent Jekyll from filtering Next.js assets.

The branch must exist before selecting it. GitHub Pages requires an entry file at the root of the configured publishing folder. The static export places `index.html` there.

Do not add a custom `.github/workflows/*pages*.yml` deployment workflow to the target repository. Branch publishing is its only Pages configuration. GitHub may internally create a Pages build run; that is not a custom workflow maintained in the repository.

## Next.js project URL and output layout

The source project uses `output: "export"` and Next.js emits the export into `out/` (confirmed with the local Next.js 16.3.8 build). The build does not rename it to `dist/`.

For a target `OWNER/REPOSITORY`, the source workflow derives:

- `STATIC_SITE_BASE_PATH=/<REPOSITORY>`
- `STATIC_SITE_URL=https://<OWNER>.github.io/<REPOSITORY>`

These values are applied consistently to Next.js `basePath`, the post-build HTML/CSS root-reference rewrite, canonical metadata, Open Graph URLs, sitemap, robots, and the standalone HTML/Markdown article exports. `trailingSlash: true` is preserved, so nested page files are exported as `route/index.html`.

The current destination is a project site, not the account-level `dfbro.github.io` site. The existing target URL and base path are therefore `/RevisionedPortfolioSite`; no custom domain is involved.

## Output preflight and size

`pnpm verify:output` remains required. `pnpm deployment:preflight` adds:

- root `index.html` and `_next/static` checks;
- expected robots, sitemap, profile and uploads paths;
- file count and total bytes/MiB;
- largest ten files;
- rejection of symlinks and source/development-only paths;
- a fail-closed size ceiling, configured by `STATIC_SITE_MAX_SIZE_MB`.

The configured ceiling is 900 MiB, below the GitHub Pages published-site limit of 1 GB. Current local output is 163.26 MiB across 1,191 files. This reports the current published export, not the deployment repository's cumulative Git history or `.git` size.

## Verify each stage

From the source repository:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:content
pnpm build
pnpm verify:output
pnpm deployment:preflight
```

Inspect the GitHub Actions run in `dfbro/RevisionedPortfolio`. The build job and publish job must both succeed. In the target repository, verify the latest commit and then check:

```sh
curl -I https://dfbro.github.io/RevisionedPortfolioSite/
curl -I https://dfbro.github.io/RevisionedPortfolioSite/writeups/pwn-truman/
curl -I https://dfbro.github.io/RevisionedPortfolioSite/sitemap.xml
curl -I https://dfbro.github.io/RevisionedPortfolioSite/robots.txt
```

Also inspect browser DevTools Network for CSS, JavaScript, fonts, images and the `_next/static` directory. A successful source push is not evidence that the target publication or Pages build succeeded.

## Concurrency and failure behavior

The workflow does not cancel an in-progress publication. It serializes source runs by ref and serializes publishes by target repository/branch. This avoids concurrent `rsync`/Git pushes racing on the same branch.

The publish job fails before target checkout if the repository variable, branch or credential is missing/invalid. It fails before committing if the artifact is missing `index.html` or Next.js assets. It never force-pushes and does not rewrite the target history.

If publication is blocked by branch protection, review the target branch rules. The deployment identity needs permission to push normal commits to the configured branch; do not solve this by force-push or by giving the PAT access to unrelated repositories.
