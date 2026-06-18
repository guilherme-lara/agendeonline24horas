import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeMode();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label="Alternar tema"
      title={isDark ? "Modo Claro" : "Modo Escuro"}
      className={cn(
        "relative inline-flex items-center h-8 w-16 rounded-full p-1 transition-all duration-500",
        "border border-border/70 glass",
        isDark ? "bg-slate-900/70" : "bg-white/70"
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-6 w-6 rounded-full transition-all duration-500 ease-out flex items-center justify-center",
          "shadow-md",
          isDark
            ? "translate-x-8 bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
            : "translate-x-0 bg-white text-amber-500"
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
      <Sun className={cn("h-3.5 w-3.5 ml-1.5 transition-opacity", isDark ? "opacity-30" : "opacity-0")} />
      <Moon className={cn("h-3.5 w-3.5 ml-auto mr-1.5 transition-opacity", isDark ? "opacity-0" : "opacity-30")} />
    </button>
  );
};

export default ThemeToggle;
