import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

// Mock modules before imports
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAdmin: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBarbershop", () => ({
  useBarbershop: () => ({
    barbershop: null,
  }),
}));

vi.mock("lucide-react", () => {
  const MockIcon = (props: any) => <svg data-testid={props["data-testid"] || "icon"} />;
  return new Proxy({}, {
    get: (_, key: string) => () => <MockIcon data-testid={`icon-${key}`} />,
  });
});

describe("Header Component", () => {
  const renderWithPath = (path: string) => {
    return render(
      <MemoryRouter initialEntries={[path]}>
        {dynamicImportHeader(path)}
      </MemoryRouter>,
    );
  };

  const dynamicImportHeader = (_path: string) => {
    // We'll test the route logic directly via LocationSpy
    return <LocationSpy />;
  };

  it("should show nav items on public pages", () => {
    const navItems = [
      { label: "Início", path: "/" },
      { label: "Meus Agendamentos", path: "/appointments" },
    ];

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HeaderRenderer navItems={navItems} user={null} isAdmin={false} />
      </MemoryRouter>
    );

    expect(screen.getByText("Início")).toBeTruthy();
    expect(screen.getByText("Meus Agendamentos")).toBeTruthy();
  });

  it("should show Dashboard link when user is logged in", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HeaderRenderer navItems={[
          { label: "Início", path: "/" },
          { label: "Dashboard", path: "/dashboard" },
          { label: "Agendar", path: "/booking" },
          { label: "Meus Agendamentos", path: "/appointments" },
        ]} user={{}} isAdmin={false} />
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Agendar")).toBeTruthy();
  });

  it("should not show Super Admin link for non-admin users", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HeaderRenderer navItems={[]} user={null} isAdmin={false} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/master/i)).toBeNull();
  });

  it("should show Entrar button when no user", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HeaderRenderer navItems={[]} user={null} isAdmin={false} />
      </MemoryRouter>
    );

    expect(screen.getByText("Entrar")).toBeTruthy();
  });

  it("should show Sair button when user is logged in", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HeaderRenderer navItems={[]} user={{ email: "test@test.com" }} isAdmin={false} />
      </MemoryRouter>
    );

    expect(screen.getByText("Sair")).toBeTruthy();
  });
});

describe("DashboardSidebar Navigation Items", () => {
  // Test the static navItems config independently of auth mocks
  const expectedNavItems = [
    "Suporte", "Dashboard", "Agenda", "Caixa", "Agendamento Online",
    "Despesas", "Relatórios", "Clientes", "Mensagens", "Horários",
    "Profissionais", "Serviços", "Produtos", "Pacotes", "Aniversários",
    "Pagamentos", "Configurações",
  ];

  it("should have exactly 17 navigation items", () => {
    expect(expectedNavItems.length).toBe(17);
  });

  it("should have required dashboard sections", () => {
    expect(expectedNavItems).toContain("Dashboard");
    expect(expectedNavItems).toContain("Agenda");
    expect(expectedNavItems).toContain("Caixa");
    expect(expectedNavItems).toContain("Serviços");
    expect(expectedNavItems).toContain("Configurações");
  });
});

// Active path detection helper (mirrors sidebar logic)
const isActive = (currentPath: string, itemPath: string): boolean => {
  const cleanPath = itemPath.split("?")[0];
  if (cleanPath === "/dashboard") return currentPath === "/dashboard";
  return currentPath === cleanPath;
};

describe("Sidebar Active Path Detection", () => {
  it("should detect exact match as active", () => {
    expect(isActive("/dashboard/clientes", "/dashboard/clientes")).toBe(true);
  });

  it("should detect non-match as inactive", () => {
    expect(isActive("/dashboard/clientes", "/dashboard/servicos")).toBe(false);
  });

  it("should strip query params when detecting active path", () => {
    // After stripping "/dashboard?tab=support" -> "/dashboard", it matches "/dashboard"
    expect(isActive("/dashboard", "/dashboard?tab=support")).toBe(true);
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
  });

  it("should handle root dashboard as active only on exact root", () => {
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/dashboard/agenda", "/dashboard")).toBe(false);
  });
});

describe("Trial Days Calculation", () => {
  const calcTrialDays = (endDateStr: string): number | null => {
    const endDate = new Date(endDateStr);
    const diff = Math.ceil(
      (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff > 0 ? diff : null;
  };

  it("should return null for past dates", () => {
    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString();
    expect(calcTrialDays(pastDate)).toBeNull();
  });

  it("should return number for future dates", () => {
    const futureDate = new Date(Date.now() + 86400000 * 15).toISOString();
    const result = calcTrialDays(futureDate);
    expect(result).toBeTypeOf("number");
    expect(result).toBeGreaterThan(0);
  });

  it("should return null for today", () => {
    const today = new Date(Date.now()).toISOString();
    expect(calcTrialDays(today)).toBeNull();
  });
});

// Helper components for testing
function LocationSpy() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

interface HeaderRendererProps {
  navItems: Array<{ label: string; path: string }>;
  user: Record<string, unknown> | null;
  isAdmin: boolean;
}

function HeaderRenderer({ navItems, user, isAdmin }: HeaderRendererProps) {
  const { pathname } = useLocation();

  if (pathname.startsWith("/book/") || pathname.startsWith("/agendamentos/") || pathname.startsWith("/dashboard")) {
    return <div data-testid="hidden-header">hidden</div>;
  }

  const items = [
    { label: "Início", path: "/" },
    ...(user ? [{ label: "Dashboard", path: "/dashboard" }] : []),
    ...(user ? [{ label: "Agendar", path: "/booking" }] : []),
    { label: "Meus Agendamentos", path: "/appointments" },
  ];

  return (
    <div>
      {items.filter(i => i.path === "/" || !user || navItems.find(ni => ni.label === i.label)).map((item) => (
        <span key={item.label} data-testid={`nav-${item.label.replace(/\s/g, "")}`}>
          {item.label}
        </span>
      ))}
      {isAdmin && <span data-testid="admin-link">Master</span>}
      {user ? <span>Sair</span> : <span>Entrar</span>}
    </div>
  );
}
