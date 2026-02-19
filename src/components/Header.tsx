import { Menu, X, LogIn, LogOut, Shield } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

// 1. IMPORTAÇÃO OBRIGATÓRIA DA IMAGEM
import logoAgenda from "@/assets/logo-agenda.png"; 

const Header = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  // Hide header on public booking pages
  if (pathname.startsWith("/book/") || pathname.startsWith("/agendamentos/")) return null;

  const navItems = [
    { label: "Início", path: "/" },
    ...(user ? [{ label: "Dashboard", path: "/dashboard" }] : []),
    ...(user ? [{ label: "Agendar", path: "/booking" }] : []),
    { label: "Meus Agendamentos", path: "/appointments" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {/* 2. USANDO A VARIÁVEL IMPORTADA AQUI */}
          <img src={logoAgenda} alt="Logo AgendeOnline24horas" className="h-8 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.path ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/super-admin"
              className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1 ${
                pathname === "/super-admin" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Shield className="h-3.5 w-3.5" /> Master
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate("/auth")}
              className="gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              <LogIn className="h-4 w-4 mr-1" /> Entrar
            </Button>
          )}
        </nav>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground p-2">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-border bg-background animate-fade-in">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`block px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary ${
                pathname === item.path ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/super-admin"
              onClick={() => setOpen(false)}
              className={`block px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary ${
                pathname === "/super-admin" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              🛡️ Painel Master
            </Link>
          )}
          {user ? (
            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="block w-full text-left px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              Sair
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="block px-6 py-3 text-sm font-medium text-primary hover:bg-secondary"
            >
              Entrar
            </Link>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;
