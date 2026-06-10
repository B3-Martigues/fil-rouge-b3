import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "../ui/Button";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "site-theme";

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getPreferredTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <Button
      aria-label={isDark ? "Activer le theme clair" : "Activer le theme sombre"}
      className="theme-toggle"
      icon={isDark ? <Sun size={18} /> : <Moon size={18} />}
      iconOnly
      size="icon"
      title={isDark ? "Theme clair" : "Theme sombre"}
      type="button"
      variant="secondary"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      Theme
    </Button>
  );
}
