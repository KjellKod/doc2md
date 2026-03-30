import { useEffect, useState, type ReactNode } from "react";
import { ThemeContext, type Theme } from "../hooks/themeContext";

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.dataset.theme = "dark";
      return;
    }

    delete document.documentElement.dataset.theme;
  }, [theme]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);

  const value = {
    theme,
    toggleTheme: () => {
      setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
    },
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
