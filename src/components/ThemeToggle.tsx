import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeMode();

  return (
    <div
      onClick={toggleTheme}
      className="flex items-center gap-1 rounded-full p-1 bg-white/80 dark:bg-black/50 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 cursor-pointer shadow-sm transition-all"
      title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
      aria-label="Alternar tema"
    >
      <div className={`p-1.5 rounded-full transition-all ${theme === "light" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-200"}`}>
        <Sun className="h-4 w-4" />
      </div>
      <div className={`p-1.5 rounded-full transition-all ${theme === "dark" ? "bg-[#2C2C2E] shadow-sm text-white" : "text-zinc-500 hover:text-zinc-700"}`}>
        <Moon className="h-4 w-4" />
      </div>
    </div>
  );
};

export default ThemeToggle;
