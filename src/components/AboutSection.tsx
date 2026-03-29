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
        Built with{" "}
        <a
          href="https://github.com/KjellKod/quest"
          target="_blank"
          rel="noopener noreferrer"
        >
          Quest
        </a>{" "}
        — vetted by Dexter, narrated by Jean-Claude.
      </p>
    </section>
  );
}
