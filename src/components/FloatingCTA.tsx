import { CalendarDays } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const FloatingCTA = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Don't show on booking pages
  if (pathname.startsWith("/booking")) return null;

  return (
    <button
      onClick={() => navigate("/booking")}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 gold-gradient text-primary-foreground font-semibold px-6 py-3.5 rounded-full shadow-gold animate-gold-pulse transition-transform hover:scale-105 md:hidden"
    >
      <CalendarDays className="h-5 w-5" />
      Agendar
    </button>
  );
};

export default FloatingCTA;
