import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeMode();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-md border border-border bg-secondary p-2 text-muted-foreground hover:text-foreground transition-colors"
      title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
      aria-label="Alternar tema"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
};

export default ThemeToggle;
