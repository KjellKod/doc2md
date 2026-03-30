import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`ghost-button theme-toggle${isDark ? " is-active" : ""}`}
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
    >
      {isDark ? "Day mode" : "Night mode"}
    </button>
  );
}
