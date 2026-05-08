import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeMode();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-2 bg-white/80 dark:bg-black/50 backdrop-blur-md hover:bg-white/90 dark:hover:bg-black/60 transition-colors"
      title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
      aria-label="Alternar tema"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
};

export default ThemeToggle;
