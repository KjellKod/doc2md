import { useState } from "react";

export default function AboutSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="about-section panel" aria-labelledby="about-title">
      <div className="about-header">
        <div>
          <p className="eyebrow">About</p>
          <h2 id="about-title">Why this utility exists</h2>
        </div>
        <button
          type="button"
          className="secondary-button"
          aria-expanded={isOpen}
          aria-controls="about-content"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          {isOpen ? "Hide details" : "Read the story"}
        </button>
      </div>

      <div
        id="about-content"
        className={`about-content${isOpen ? " is-open" : ""}`}
        hidden={!isOpen}
      >
        <p>
          doc2md started with a practical question that kept returning:
          how do you turn an Excel sheet, a PDF, or a Word document into
          Markdown without building a small career around conversion tools?
        </p>
        <p>
          Instead of collecting one-off commands and workarounds, the project
          became a focused browser utility: local-first, privacy-friendly, and
          intentionally easy to trust. Drop in a file, review the Markdown,
          download the result, and move on with your day.
        </p>
        <p>
          The point is not theatrical conversion fidelity. It is lowering
          friction for people entering AI-assisted workflows and showing what a
          well-scoped, honest, polished utility can look like when it refuses
          to pretend that every format is more cooperative than it really is.
        </p>
      </div>

      <p className="about-tagline">
        <a
          href="https://github.com/KjellKod/doc2md"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            className="github-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.73 0 8.33c0 3.68 2.29 6.8 5.47 7.9.4.08.55-.18.55-.4 0-.2-.01-.87-.01-1.57-2.01.45-2.53-.51-2.69-.98-.09-.25-.48-.98-.82-1.18-.28-.15-.68-.53-.01-.54.63-.01 1.08.6 1.23.85.72 1.25 1.87.9 2.33.68.07-.54.28-.9.51-1.1-1.78-.21-3.64-.93-3.64-4.12 0-.91.31-1.66.82-2.24-.08-.21-.36-1.06.08-2.21 0 0 .67-.22 2.2.85A7.3 7.3 0 0 1 8 4.78c.68 0 1.37.09 2.01.28 1.53-1.08 2.2-.85 2.2-.85.44 1.15.16 2 .08 2.21.51.58.82 1.32.82 2.24 0 3.2-1.87 3.91-3.65 4.12.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .22.15.49.55.4A8.35 8.35 0 0 0 16 8.33C16 3.73 12.42 0 8 0Z" />
          </svg>{" "}
          doc2md
        </a>
        {" "}— built with{" "}
        <a
          href="https://github.com/KjellKod/quest"
          target="_blank"
          rel="noopener noreferrer"
        >
          Quest
        </a>
        {" "}— vetted by{" "}
        <a
          href="https://github.com/KjellKod/doc2md/tree/main/docs/dexter-journal"
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Dexter</strong>
        </a>
        , narrated by{" "}
        <a
          href="https://github.com/KjellKod/doc2md/tree/main/docs/journal"
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>Jean-Claude</strong>
        </a>
        .
      </p>

      <p className="about-support">
        If doc2md is useful in your workflow,{" "}
        <a
          href="https://github.com/sponsors/KjellKod"
          target="_blank"
          rel="noopener noreferrer"
        >
          sponsor ongoing work on GitHub
        </a>
        .
      </p>
    </section>
  );
}
