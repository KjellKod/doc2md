The first true prerequisite is human setup: confirm doc2md.dev / updates.doc2md.dev, Cloudflare account, GitHub environments, and secrets.

## Commercial (Phase 7b) human steps — updated 2026-07-07

The 2026-07-07 sharpen removed the biggest item: no Cloudflare Worker issuer is needed for v1 (Polar's license-key API is the interim issuer). Remaining human steps, none of which block the in-repo Phase 7b work:

1. Create the Polar account and org, sandbox mode first; configure the $20/yr subscription product with license keys enabled. Needed before end-to-end purchase testing.
2. doc2md.dev DNS plus hosting for the commercial pages (the Cloudflare deploy-prep quest below builds the rails), and support@doc2md.dev before taking money.
3. Explicit go-live approval, last.

In-repo sequencing lives in docs/implementation/mac-commercial-phase-7b-plan.md.

  The first Quest I’d run is the deploy-prep PR for Cloudflare Workers Static Assets. It gives us the Cloudflare trust/deploy path that the Sparkle update endpoint can reuse.

  /quest "Land the doc2md Cloudflare Workers deploy-prep PR.

  Goal:
  Move the hosted doc2md web app deployment path from GitHub Pages toward Cloudflare Workers Static Assets, without changing Mac updater behavior yet and without breaking the existing web app.

  Context:
  - Read AGENTS.md first.
  - Read docs/implementation/cloudflare-workers-deployment.md.
  - Read docs/implementation/mac-sparkle-update-roadmap.md only for the relationship to updates.doc2md.dev; do not implement Sparkle changes in this quest.
  - doc2md is Vite/static, not Next/OpenNext. Do not copy sketch2md's OpenNext setup.
  - Preserve the existing GitHub Pages deployment until Cloudflare is verified.

  Scope in:
  1. Add an exact-pinned Wrangler dev dependency.
  2. Add a Workers Static Assets config for doc2md.
  3. Add a Cloudflare hosted build mode that emits root-relative assets.
  4. Keep desktop build base as ./.
  5. Keep GitHub Pages build base as /doc2md/ until retirement is explicit.
  6. Ensure the Cloudflare build includes the same public install artifacts as Pages:
     - hosted app
     - doc2md-core-latest.tgz
     - latest-tarball.json
     - doc2md-skill.skill
  7. Add package scripts:
     - build:cf
     - preview:cf
     - deploy:cf
  8. Add production and preview workflow drafts following the trust posture in docs/implementation/cloudflare-workers-deployment.md:
     - no-secret build job
     - fresh token-bearing deploy/upload job
     - pinned actions/Wrangler
     - npm ci/install with --ignore-scripts
     - tag-only production deploys
     - preview isolation and clear skip behavior
  9. Update scripts/security_ci_guard.py and tests if the new workflows introduce new secret-bearing patterns.
  10. Update docs only where needed to keep the Cloudflare plan accurate.

  Scope out:
  - Do not deploy.
  - Do not touch Cloudflare dashboard/account values.
  - Do not add runtime bindings, KV, R2, D1, Durable Objects, merchant secrets, issuer routes, checkout links, or API secrets.
  - Do not change Sparkle SUFeedURL or Mac update behavior.
  - Do not retire GitHub Pages in this PR.
  - Do not change converter behavior, hosted app UX, or desktop app UX.

  Acceptance criteria:
  - npm run lint passes.
  - npm run typecheck passes.
  - npm test -- --run passes.
  - npm run build passes.
  - npm run build:cf passes.
  - python3 scripts/security_ci_guard.py passes.
  - Existing hosted web build remains intact.
  - New Cloudflare path is documented and ready for manual environment/secrets setup.
  - The PR is small enough to review as deployment prep, not product behavior change.

  Notes:
  If Cloudflare human setup is not ready, the workflows may be merged with clear skip/failure messaging, but no production deploy should be attempted."

  After that lands, the next quest is the Sparkle updater PR or updates.doc2md.dev Worker, depending on whether you want Cloudflare ready first or a GitHub-backed updater fallback.
