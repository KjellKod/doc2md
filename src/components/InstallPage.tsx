import { useEffect, useState } from "react";

interface TarballManifest {
  filename: string;
  version: string;
}

const BASE_PATH = import.meta.env.BASE_URL;
const BEGINNER_INSTALL_URL =
  "https://github.com/KjellKod/doc2md/blob/main/INSTALL.md";
const CORE_USAGE_URL =
  "https://github.com/KjellKod/doc2md/blob/main/docs/using-doc2md-core.md";
const SKILL_INSTALL_URL =
  "https://github.com/KjellKod/doc2md/blob/main/INSTALL.md#portable-skill-wrapper";

function InstallStatus({
  manifest,
  state,
  onRetry,
}: {
  manifest: TarballManifest | null;
  state: "loading" | "ready" | "unavailable";
  onRetry: () => void;
}) {
  if (state === "loading") {
    return (
      <p className="install-download-note">
        Checking for the latest packaged tarball from GitHub Pages.
      </p>
    );
  }

  if (state === "ready" && manifest) {
    return (
      <p className="install-download-note">
        Latest Pages artifact: <strong>{manifest.filename}</strong> (version{" "}
        {manifest.version}).
      </p>
    );
  }

  return (
    <div className="install-download-note">
      <p>
        The tarball manifest is not available in local dev builds yet. Use the
        button after a Pages deploy, or build locally with{" "}
        <code>npm run pack:local --workspace=@doc2md/core</code>.
      </p>
      <button type="button" className="ghost-button" onClick={onRetry}>
        Retry manifest fetch
      </button>
    </div>
  );
}

export default function InstallPage({ active }: { active: boolean }) {
  const [manifest, setManifest] = useState<TarballManifest | null>(null);
  const [manifestState, setManifestState] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");

  function retryManifestFetch() {
    setManifest(null);
    setManifestState("loading");
  }

  useEffect(() => {
    if (!active || manifestState !== "loading") {
      return;
    }

    let isCancelled = false;

    async function loadManifest() {
      try {
        const response = await fetch(`${BASE_PATH}latest-tarball.json`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Manifest not found.");
        }

        const data = (await response.json()) as Partial<TarballManifest>;

        if (typeof data.filename !== "string" || typeof data.version !== "string") {
          throw new Error("Manifest is invalid.");
        }

        if (!isCancelled) {
          setManifest({
            filename: data.filename,
            version: data.version,
          });
          setManifestState("ready");
        }
      } catch {
        if (!isCancelled) {
          setManifest(null);
          setManifestState("unavailable");
        }
      }
    }

    void loadManifest();

    return () => {
      isCancelled = true;
    };
  }, [active, manifestState]);

  const downloadHref = manifest ? `${BASE_PATH}${manifest.filename}` : null;

  return (
    <div className="install-stack">
      <section className="panel install-hero-panel" aria-labelledby="install-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Install & Use</p>
            <h2 id="install-title">
              Install doc2md for CLI, automation, and agent workflows
            </h2>
            <p className="panel-copy">
              The browser UI is still the fastest path for one-off work. This
              page is for the packaged tarball, the Node CLI, and the portable
              repo skill.
            </p>
          </div>
        </div>

        <div className="install-actions" role="group" aria-label="Install actions">
          {downloadHref ? (
            <a className="download-button" href={downloadHref} download>
              Download latest tarball
            </a>
          ) : (
            <button type="button" className="download-button" disabled>
              Latest tarball on deploy builds
            </button>
          )}
          <a
            className="secondary-button"
            href={BEGINNER_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open beginner install guide
          </a>
          <a
            className="ghost-button"
            href={CORE_USAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read core usage docs
          </a>
        </div>

        <InstallStatus
          manifest={manifest}
          state={manifestState}
          onRetry={retryManifestFetch}
        />

        <div className="install-card-grid">
          <article className="install-card">
            <p className="eyebrow">CLI</p>
            <h3>Global or project-local installs</h3>
            <p>
              Use the tarball when you want `doc2md` in a terminal, shell
              script, or local automation flow.
            </p>
          </article>
          <article className="install-card">
            <p className="eyebrow">Node</p>
            <h3>`@doc2md/core` without browser UI</h3>
            <p>
              Use the package for batch conversion, MCP-style preprocessing, or
              scripts that need structured JSON results.
            </p>
          </article>
          <article className="install-card">
            <p className="eyebrow">Agents</p>
            <h3>Portable skill packaging</h3>
            <p>
              Ship `.skills/doc-to-markdown/` with your repo when you want a
              thin, copyable wrapper around the same package contract.
            </p>
          </article>
        </div>
      </section>

      <div className="install-grid">
        <section className="panel install-panel" aria-labelledby="install-steps-title">
          <div className="panel-heading">
            <div>
              <h2 id="install-steps-title">Fastest supported setup</h2>
              <p className="panel-copy">
                Use the tarball when you want the current supported package path
                without waiting for public npm publication.
              </p>
            </div>
          </div>

          <div className="install-steps">
            <article className="install-step">
              <p className="eyebrow">1. Download</p>
              <h3>Get the tarball from Pages or build it locally</h3>
              <p>
                Use the button above after a deploy, or build the package inside
                this repo when you are validating changes locally. The exact
                local build command is shown below.
              </p>
              <pre className="install-code">
                <code>npm run pack:local --workspace=@doc2md/core</code>
              </pre>
            </article>

            <article className="install-step">
              <p className="eyebrow">2. Install</p>
              <h3>Choose global or project-local</h3>
              <p>
                Global installs give you `doc2md` everywhere. Project-local
                installs keep the package inside one repo and pair naturally
                with `npx`.
              </p>
              <pre className="install-code">
                <code>
                  npm install -g /absolute/path/to/doc2md-core-&lt;version&gt;.tgz
                </code>
              </pre>
              <pre className="install-code">
                <code>
                  npm install /absolute/path/to/doc2md-core-&lt;version&gt;.tgz
                </code>
              </pre>
            </article>

            <article className="install-step">
              <p className="eyebrow">3. Run</p>
              <h3>Convert one file or many</h3>
              <p>
                Successful runs write Markdown to the output directory you pass
                with `-o`.
              </p>
              <pre className="install-code">
                <code>doc2md /absolute/path/resume.pdf -o ./out</code>
              </pre>
              <pre className="install-code">
                <code>
                  npx doc2md /absolute/path/a.pdf /absolute/path/b.docx -o ./out
                </code>
              </pre>
            </article>
          </div>
        </section>

        <section className="panel install-panel" aria-labelledby="agent-paths-title">
          <div className="panel-heading">
            <div>
              <h2 id="agent-paths-title">Skill and automation paths</h2>
              <p className="panel-copy">
                Keep the browser app for interactive review. Use the package or
                the skill when you need repeatable automation.
              </p>
            </div>
          </div>

          <div className="install-steps">
            <article className="install-step">
              <p className="eyebrow">Portable skill</p>
              <h3>Copy the skill into the target repo</h3>
              <p>
                The skill stays thin on purpose. It depends on `@doc2md/core`
                and documents how agents should ask about output paths, avoid
                risky writes, and report confidence.
              </p>
              <pre className="install-code">
                <code>
                  node .skills/doc-to-markdown/scripts/convert-documents.mjs
                  {" \\\n"}  --output-dir ./out
                  {" \\\n"}  ./docs/resume.pdf
                </code>
              </pre>
            </article>

            <article className="install-step">
              <p className="eyebrow">Reference docs</p>
              <h3>Use the right guide for the job</h3>
              <ul className="install-link-list">
                <li>
                  <a
                    href={BEGINNER_INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    INSTALL.md for beginners
                  </a>
                </li>
                <li>
                  <a
                    href={CORE_USAGE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    `@doc2md/core` usage docs
                  </a>
                </li>
                <li>
                  <a
                    href={SKILL_INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Portable skill wrapper setup
                  </a>
                </li>
              </ul>
            </article>

            <article className="install-step">
              <p className="eyebrow">Reality check</p>
              <h3>What exists today</h3>
              <ul className="install-link-list">
                <li>The tarball is the supported package distribution path.</li>
                <li>
                  The browser app is still the easiest path for one-off private
                  conversion.
                </li>
                <li>
                  The portable skill is repo-local packaging, not a second
                  converter system.
                </li>
              </ul>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
