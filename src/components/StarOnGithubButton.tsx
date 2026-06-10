import { Star } from "lucide-react";

const REPO_URL = "https://github.com/KjellKod/doc2md";

type StarOnGithubButtonProps = {
  // "compact" collapses the label to "Star" (mark + word) for the hero-top
  // actions cluster; "full" shows "Star on GitHub" for the About footer.
  variant?: "compact" | "full";
};

// Static, no-network "star this repo" call to action. Intentionally does NOT
// fetch a live stargazer count: doc2md is local-first and privacy-friendly,
// so the landing page makes zero github.com requests on load. The link just
// opens the repo, where GitHub renders the real star control.
export default function StarOnGithubButton({
  variant = "full",
}: StarOnGithubButtonProps) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`star-github-button${variant === "compact" ? " star-github-button--compact" : ""}`}
      aria-label="Star doc2md on GitHub"
    >
      <Star className="star-github-icon" aria-hidden="true" />
      <span className="star-github-label">
        {variant === "compact" ? "Star" : "Star on GitHub"}
      </span>
    </a>
  );
}
