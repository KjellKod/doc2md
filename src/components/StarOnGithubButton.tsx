import { Star } from "lucide-react";

const REPO_URL = "https://github.com/KjellKod/doc2md";

// Static, no-network "star this repo" call to action shown in the About
// footer. Intentionally does NOT fetch a live stargazer count: doc2md is
// local-first and privacy-friendly, so the landing page makes zero github.com
// requests on load. The link just opens the repo, where GitHub renders the
// real star control.
export default function StarOnGithubButton() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="star-github-button"
      aria-label="Star doc2md on GitHub"
    >
      <Star className="star-github-icon" aria-hidden="true" />
      <span className="star-github-label">Star on GitHub</span>
    </a>
  );
}
